#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import subprocess
import numpy as np
import warnings
import os
import sys
import tempfile
import csv
import re
from Bio.SeqUtils.ProtParam import ProteinAnalysis
from Bio.PDB import PDBParser, MMCIFParser, PDBIO
from Bio.SeqUtils import seq1
from scipy.spatial.distance import cdist
from Bio import BiopythonWarning

warnings.simplefilter('ignore', BiopythonWarning)

CHARGE_SCALE = {'ASP': -1.0, 'GLU': -1.0, 'LYS': 1.0, 'ARG': 1.0, 'HIS': 0.1}
KD_SCALE = {
    'ARG': -4.5, 'LYS': -3.9, 'ASN': -3.5, 'ASP': -3.5, 'GLN': -3.5,
    'GLU': -3.5, 'HIS': -3.2, 'PRO': -1.6, 'TYR': -1.3, 'TRP': -0.9,
    'SER': -0.8, 'THR': -0.7, 'GLY': -0.4, 'ALA':  1.8, 'MET':  1.9,
    'CYS':  2.5, 'PHE':  2.8, 'LEU':  3.8, 'VAL':  4.2, 'ILE':  4.5
}

def normalize_kd(res_name):
    return 1.0 + (KD_SCALE.get(res_name, 0) + 4.5) / 9.0

IMGT_CDR_ANCHORS = set(
    list(range(25, 41)) + list(range(54, 68)) + list(range(103, 120))
)

def is_pure_imgt_cdr(imgt_num):
    if imgt_num is None:
        return False
    return (27 <= imgt_num <= 38) or (56 <= imgt_num <= 65) or (105 <= imgt_num <= 117)


def assign_3d_secondary_structure(chain_residues):
    """
    Assigns 3D secondary structure ('Strand' vs 'Loop') directly from 3D PDB
    backbone coordinates (N, CA, C, O) using the Kabsch & Sander (1983) DSSP
    electrostatic hydrogen-bond energy equation (E < -0.5 kcal/mol).
    """
    n = len(chain_residues)
    if n == 0:
        return

    coords_N = [None] * n
    coords_CA = [None] * n
    coords_C = [None] * n
    coords_O = [None] * n
    coords_H = [None] * n

    for i, res in enumerate(chain_residues):
        if 'N' in res:
            coords_N[i] = np.array(res['N'].get_coord(), dtype=float)
        if 'CA' in res:
            coords_CA[i] = np.array(res['CA'].get_coord(), dtype=float)
        if 'C' in res:
            coords_C[i] = np.array(res['C'].get_coord(), dtype=float)
        if 'O' in res:
            coords_O[i] = np.array(res['O'].get_coord(), dtype=float)

    for i in range(1, n):
        res_name = chain_residues[i].resname.strip().upper()
        if res_name == 'PRO' or coords_N[i] is None:
            continue
        if coords_C[i - 1] is not None and coords_O[i - 1] is not None:
            if np.linalg.norm(coords_N[i] - coords_C[i - 1]) > 2.5:
                continue
            co_vec = coords_C[i - 1] - coords_O[i - 1]
            norm = np.linalg.norm(co_vec)
            if norm > 1e-6:
                coords_H[i] = coords_N[i] + 1.01 * (co_vec / norm)

    # Kabsch-Sander H-bond matrix: hbond[donor_i (N-H), acceptor_j (C=O)] = True
    # Standard DSSP Top-2 rule: each N-H donor and C=O acceptor retains at most
    # the 2 lowest-energy H-bonds with E < -0.5 kcal/mol.
    q1q2_f = 0.42 * 0.20 * 332.0
    donor_hbonds = [[] for _ in range(n)]
    acceptor_hbonds = [[] for _ in range(n)]

    for i in range(1, n):
        if coords_N[i] is None or coords_H[i] is None:
            continue
        n_pos = coords_N[i]
        h_pos = coords_H[i]
        for j in range(n):
            if abs(i - j) < 2 or coords_C[j] is None or coords_O[j] is None:
                continue
            c_pos = coords_C[j]
            o_pos = coords_O[j]
            r_on = np.linalg.norm(o_pos - n_pos)
            if r_on > 5.2:
                continue
            r_ch = np.linalg.norm(c_pos - h_pos)
            r_oh = np.linalg.norm(o_pos - h_pos)
            r_cn = np.linalg.norm(c_pos - n_pos)
            if min(r_on, r_ch, r_oh, r_cn) < 0.5:
                continue
            energy = q1q2_f * (1.0 / r_on + 1.0 / r_ch - 1.0 / r_oh - 1.0 / r_cn)
            if energy < -0.5:
                donor_hbonds[i].append((energy, j))
                acceptor_hbonds[j].append((energy, i))

    donor_top2 = set()
    for i in range(n):
        if donor_hbonds[i]:
            donor_hbonds[i].sort(key=lambda x: x[0])
            for _, j in donor_hbonds[i][:2]:
                donor_top2.add((i, j))

    acceptor_top2 = set()
    for j in range(n):
        if acceptor_hbonds[j]:
            acceptor_hbonds[j].sort(key=lambda x: x[0])
            for _, i in acceptor_hbonds[j][:2]:
                acceptor_top2.add((i, j))

    hbond = np.zeros((n, n), dtype=bool)
    for (i, j) in donor_top2.intersection(acceptor_top2):
        hbond[i, j] = True

    is_strand_or_helix = [False] * n

    # Parallel and Antiparallel Beta-Bridges (Kabsch & Sander 1983)
    # Note: Kabsch-Sander Bond(acceptor, donor) == hbond[donor, acceptor].
    for i in range(1, n - 1):
        for j in range(1, n - 1):
            if abs(i - j) < 3:
                continue
            par1 = hbond[j, i - 1] and hbond[i + 1, j]
            par2 = hbond[i, j - 1] and hbond[j + 1, i]
            anti1 = hbond[j, i] and hbond[i, j]
            anti2 = hbond[j + 1, i - 1] and hbond[i + 1, j - 1]
            if par1 or par2 or anti1 or anti2:
                is_strand_or_helix[i] = True
                is_strand_or_helix[j] = True

    for turn_n in (3, 4, 5):
        for i in range(n - turn_n - 1):
            if hbond[i + turn_n, i] and hbond[i + turn_n + 1, i + 1]:
                for k in range(i + 1, i + turn_n + 1):
                    is_strand_or_helix[k] = True

    for i, res in enumerate(chain_residues):
        res.xtra['sec_struct'] = 'Strand' if is_strand_or_helix[i] else 'Loop'


def get_exposed_via_psa(structure, psa_bin):
    model = structure[0]
    all_residues = list(model.get_residues())
    fd, tmp_path = tempfile.mkstemp(suffix=".pdb")
    os.close(fd)
    try:
        io = PDBIO()
        io.set_structure(structure)
        io.save(tmp_path)
        cmd = [psa_bin, "-t", tmp_path]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        psa_lines = [line for line in result.stdout.splitlines() if line.startswith("ACCESS")]
        if len(psa_lines) != len(all_residues):
            raise ValueError("PSA residue count mismatch with 3D structure")
        surface_exposed = []
        for res, line in zip(all_residues, psa_lines):
            total_side_per_str = line[61:66].strip()
            total_side_per = 100.0 if '*' in total_side_per_str else float(total_side_per_str)
            res.xtra['side_rsa'] = total_side_per
            if total_side_per >= 7.5:
                surface_exposed.append(res)
        return surface_exposed
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


CORE_DEAMIDATION_MOTIFS = {'NG', 'NS', 'NT', 'NN', 'NH'}
CORE_ISOMERIZATION_MOTIFS = {'DG', 'DS', 'DD'}


def evaluate_site_state(pos, motif, chain_residues, ptm_rsa_cutoff=7.5):
    idx = pos - 1
    if chain_residues is None or not (0 <= idx < len(chain_residues)):
        raise ValueError(f"3D structure residue missing at linear position {pos}")

    res = chain_residues[idx]
    imgt_num = res.xtra.get('imgt_num')
    imgt_label = res.xtra.get('imgt_label') or str(imgt_num or pos)
    side_rsa = res.xtra.get('side_rsa', 0.0)
    sec_str = res.xtra.get('sec_struct', 'Loop')

    is_cdr = is_pure_imgt_cdr(imgt_num)
    is_loop = (sec_str == 'Loop')
    is_exp = (side_rsa >= ptm_rsa_cutoff)

    region_str = 'CDR' if is_cdr else 'FR'
    exp_str = 'Exp' if is_exp else 'Buried'
    token = f"{pos}@IMGT{imgt_label}({motif})[{region_str}-{sec_str},{exp_str}]"
    return token, is_cdr, is_loop, is_exp


def format_site_token(pos, motif, chain_residues, ptm_rsa_cutoff=7.5):
    token, _, _, _ = evaluate_site_state(pos, motif, chain_residues, ptm_rsa_cutoff)
    return token


def predict_n_glycosylation_sites(sequence, chain_residues, ptm_rsa_cutoff=7.5):
    glycosylation_sites = []
    for match in re.finditer(r'(?=(N[^P][ST]))', sequence):
        position = match.start() + 1
        residue = match.group(1)
        glycosylation_sites.append(
            format_site_token(position, residue, chain_residues, ptm_rsa_cutoff)
        )
    return glycosylation_sites


def find_deamidation_sites(sequence, chain_residues, ptm_rsa_cutoff=7.5):
    sites = []
    for match in re.finditer(r'(?=(N[ACDEFGHIKLMNPQRSTVWY]))', sequence):
        position = match.start() + 1
        motif = match.group(1)
        token, _, is_loop, is_exp = evaluate_site_state(position, motif, chain_residues, ptm_rsa_cutoff)
        if motif in CORE_DEAMIDATION_MOTIFS:
            sites.append(token)
        elif is_loop and is_exp:
            sites.append(token)
    return ', '.join(sites) if sites else "None"


def find_isomerization_sites(sequence, chain_residues, ptm_rsa_cutoff=7.5):
    sites = []
    for match in re.finditer(r'(?=(D[ACDEFGHIKLMNPQRSTVWY]))', sequence):
        position = match.start() + 1
        motif = match.group(1)
        token, _, is_loop, is_exp = evaluate_site_state(position, motif, chain_residues, ptm_rsa_cutoff)
        if motif in CORE_ISOMERIZATION_MOTIFS:
            sites.append(token)
        elif is_loop and is_exp:
            sites.append(token)
    return ', '.join(sites) if sites else "None"


def find_ptm_sites(sequence, pattern, chain_residues, ptm_rsa_cutoff=7.5):
    sites = []
    for match in re.finditer(pattern, sequence):
        position = match.start() + 1
        residue = match.group()
        sites.append(
            format_site_token(position, residue, chain_residues, ptm_rsa_cutoff)
        )
    return ', '.join(sites) if sites else "None"


def _extract_cys_entries(sequence, chain_residues, chain_tag='VHH'):
    entries = []
    for m in re.finditer(r'C', sequence):
        pos = m.start() + 1
        idx = pos - 1
        res = chain_residues[idx] if (chain_residues is not None and 0 <= idx < len(chain_residues)) else None
        sg = np.array(res['SG'].get_coord(), dtype=float) if (res is not None and 'SG' in res) else None
        cb = np.array(res['CB'].get_coord(), dtype=float) if (res is not None and 'CB' in res) else None
        ca = np.array(res['CA'].get_coord(), dtype=float) if (res is not None and 'CA' in res) else None
        imgt_num = res.xtra.get('imgt_num') if res is not None else None
        entries.append({
            'chain': chain_tag,
            'pos': pos,
            'imgt_num': imgt_num,
            'sg': sg,
            'cb': cb,
            'ca': ca
        })
    return entries


def _disulfide_pair_distance(a, b):
    """
    Combined 3D geometric disulfide-bond criterion resilient to NanoBodyBuilder2/OpenMM
    unbonded relaxation while preserving strict stereochemical specificity:
      1. Both SG present: SG-SG <= 3.5 A; OR (CB-CB <= 5.0 A and SG-SG <= 5.5 A);
         OR canonical IMGT 23-104 with CA-CA <= 7.5 A.
      2. SG missing on either residue, both CB present: CB-CB <= 4.8 A;
         OR canonical IMGT 23-104 with CA-CA <= 7.5 A.
      3. Only CA present: canonical IMGT 23-104 with CA-CA <= 7.5 A.
    """
    d_sg = float(np.linalg.norm(a['sg'] - b['sg'])) if (a['sg'] is not None and b['sg'] is not None) else None
    d_cb = float(np.linalg.norm(a['cb'] - b['cb'])) if (a['cb'] is not None and b['cb'] is not None) else None
    d_ca = float(np.linalg.norm(a['ca'] - b['ca'])) if (a['ca'] is not None and b['ca'] is not None) else None
    is_canonical_23_104 = ({a['imgt_num'], b['imgt_num']} == {23, 104})

    if d_sg is not None:
        if d_sg <= 3.5:
            return d_sg
        if d_cb is not None and d_cb <= 5.0 and d_sg <= 5.5:
            return d_sg
        if is_canonical_23_104 and d_ca is not None and d_ca <= 7.5:
            return d_sg
        return None

    if d_cb is not None:
        if d_cb <= 4.8:
            return d_cb
        if is_canonical_23_104 and d_ca is not None and d_ca <= 7.5:
            return d_cb
        return None

    if is_canonical_23_104 and d_ca is not None and d_ca <= 7.5:
        return d_ca
    return None


def match_disulfides_1to1(cys_entries):
    m = len(cys_entries)
    if m < 2:
        return []

    adj = [[] for _ in range(m)]
    edges = []
    for i in range(m):
        for j in range(i + 1, m):
            dist = _disulfide_pair_distance(cys_entries[i], cys_entries[j])
            if dist is not None:
                adj[i].append((j, dist))
                adj[j].append((i, dist))
                edges.append((dist, i, j))

    if not edges:
        return []

    if m <= 16:
        memo = {}

        def solve(mask):
            if mask in memo:
                return memo[mask]
            first = -1
            for i in range(m):
                if not (mask & (1 << i)):
                    first = i
                    break
            if first == -1:
                res = (0, 0.0, ())
                memo[mask] = res
                return res

            best = solve(mask | (1 << first))
            for j, dist in adj[first]:
                if not (mask & (1 << j)):
                    sub_cnt, sub_dist, sub_pairs = solve(mask | (1 << first) | (1 << j))
                    cand = (sub_cnt + 1, sub_dist + dist, ((first, j, dist),) + sub_pairs)
                    if cand[0] > best[0] or (cand[0] == best[0] and cand[1] < best[1] - 1e-9):
                        best = cand
            memo[mask] = best
            return best

        _, _, best_pairs = solve(0)
        return list(best_pairs)

    edges.sort(key=lambda x: x[0])
    used = set()
    pairs = []
    for dist, i, j in edges:
        if i not in used and j not in used:
            used.add(i)
            used.add(j)
            pairs.append((i, j, dist))
    return pairs


def check_free_cysteine(sequence, chain_residues, ptm_rsa_cutoff=7.5):
    entries = _extract_cys_entries(sequence, chain_residues, 'VHH')
    cys_count = len(entries)
    if cys_count == 0:
        return "0 (Free: No)"

    pairs = match_disulfides_1to1(entries)
    paired_indices = set()
    for i, j, _ in pairs:
        paired_indices.add(i)
        paired_indices.add(j)

    free_tokens = []
    for idx, entry in enumerate(entries):
        if idx not in paired_indices:
            tok = format_site_token(entry['pos'], 'C', chain_residues, ptm_rsa_cutoff)
            free_tokens.append(tok)

    if free_tokens:
        return f"{cys_count} (Free: Yes @ {'; '.join(free_tokens)})"
    return f"{cys_count} (Free: No)"


def analyze_sequence(sequence, chain_residues, ptm_rsa_cutoff=7.5):
    if not isinstance(sequence, str) or len(sequence.strip()) == 0:
        return {'Length': 0, 'Mol_Weight': 0.0, 'pI': 0.0, 'GRAVY': 0.0, 'Instability': 0.0, 'Charge_pH7.4': 0.0, 'N_Glyco_Count': 0, 'N_Glyco_Sites': 'None', 'Deamidation': 'None', 'Isomerization': 'None', 'Oxidation': 'None', 'Cys_Status': 'None'}

    sequence = sequence.strip().upper()
    clean_seq = re.sub(r'[^ACDEFGHIKLMNPQRSTVWY]', '', sequence)

    if len(clean_seq) == 0:
        return {'Length': 0, 'Mol_Weight': 0.0, 'pI': 0.0, 'GRAVY': 0.0, 'Instability': 0.0, 'Charge_pH7.4': 0.0, 'N_Glyco_Count': 0, 'N_Glyco_Sites': 'None', 'Deamidation': 'None', 'Isomerization': 'None', 'Oxidation': 'None', 'Cys_Status': 'None'}

    analyzed_seq = ProteinAnalysis(clean_seq)
    nglyc_list = predict_n_glycosylation_sites(clean_seq, chain_residues, ptm_rsa_cutoff)
    return {
        'Length': len(clean_seq),
        'Mol_Weight': round(analyzed_seq.molecular_weight(), 2),
        'pI': round(analyzed_seq.isoelectric_point(), 2),
        'GRAVY': round(analyzed_seq.gravy(), 3),
        'Instability': round(analyzed_seq.instability_index(), 2),
        'Charge_pH7.4': round(analyzed_seq.charge_at_pH(7.4), 2),
        'N_Glyco_Count': len(nglyc_list),
        'N_Glyco_Sites': ', '.join(nglyc_list) if nglyc_list else "None",
        'Deamidation': find_deamidation_sites(clean_seq, chain_residues, ptm_rsa_cutoff),
        'Isomerization': find_isomerization_sites(clean_seq, chain_residues, ptm_rsa_cutoff),
        'Oxidation': find_ptm_sites(clean_seq, r'[MW]', chain_residues, ptm_rsa_cutoff),
        'Cys_Status': check_free_cysteine(clean_seq, chain_residues, ptm_rsa_cutoff)
    }


def process_single_structure(file_path, psa_bin, ptm_rsa_cutoff=7.5):
    if file_path.lower().endswith('.cif'):
        parser = MMCIFParser(QUIET=True)
    else:
        parser = PDBParser(QUIET=True)
    structure = parser.get_structure('RAW', file_path)
    model = structure[0]
    for chain in model:
        for res in list(chain):
            if res.id[0] != ' ':
                chain.detach_child(res.id)
            for a in list(res):
                if a.element == 'H':
                    res.detach_child(a.id)

    vh_chain = None
    for chain in list(model.get_chains()):
        residues = list(chain.get_residues())
        if not residues:
            continue
        seq = "".join([seq1(res.resname, custom_map={"UNK": "X"}) for res in residues])
        try:
            result = subprocess.run(["ANARCI", "--sequence", seq, "--scheme", "imgt"], capture_output=True, text=True, check=True)
        except Exception:
            result = subprocess.run(["anarci", "--sequence", seq, "--scheme", "imgt"], capture_output=True, text=True, check=True)
        mapping = []
        h_count, l_count = 0, 0
        for line in result.stdout.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if stripped.startswith("//"):
                if mapping:
                    break
                continue
            parts = stripped.split()
            if len(parts) >= 3 and parts[0] in ['H', 'K', 'L']:
                c_type = 'H' if parts[0] == 'H' else 'L'
                if c_type == 'H':
                    h_count += 1
                else:
                    l_count += 1
                if parts[-1] != '-':
                    imgt_num = int(parts[1])
                    imgt_label = f"{parts[1]}{parts[2]}" if (len(parts) >= 4 and re.match(r'^[A-Za-z]+$', parts[2])) else str(parts[1])
                    mapping.append((imgt_num, imgt_label, parts[-1]))
        if not mapping:
            model.detach_child(chain.id)
            continue
        if h_count > l_count:
            chain.xtra['chain_type'] = 'H'
            vh_chain = chain
            chain.xtra['sequence'] = seq
        else:
            model.detach_child(chain.id)
            continue

        anarci_seq = "".join(m[2] for m in mapping)
        start_idx = seq.find(anarci_seq)
        if start_idx == -1:
            pattern_str = "".join(f"[{re.escape(m[2])}X]" for m in mapping)
            match_sub = re.search(pattern_str, seq)
            if match_sub:
                start_idx = match_sub.start()
        if start_idx == -1:
            raise ValueError(f"ANARCI domain sequence could not be contiguously aligned to chain {chain.id}")

        for offset, m in enumerate(mapping):
            residues[start_idx + offset].xtra['imgt_num'] = m[0]
            residues[start_idx + offset].xtra['imgt_label'] = m[1]

        assign_3d_secondary_structure(residues)

    if not vh_chain:
        raise ValueError("No VH/VHH detected")

    tetrad_dict = {42: '-', 49: '-', 50: '-', 52: '-'}
    for r in vh_chain:
        imgt_num = r.xtra.get('imgt_num')
        if imgt_num in tetrad_dict:
            tetrad_dict[imgt_num] = seq1(r.resname, custom_map={"UNK": "X"})
    tetrad_motif = f"{tetrad_dict[42]}{tetrad_dict[49]}{tetrad_dict[50]}{tetrad_dict[52]}"

    surface_exposed = get_exposed_via_psa(structure, psa_bin)
    salt_bridges = set()
    pos_atoms = [a for r in surface_exposed if r.resname in ['ARG', 'LYS'] for a in r if a.name in ['NH1', 'NH2', 'NZ']]
    neg_atoms = [a for r in surface_exposed if r.resname in ['ASP', 'GLU'] for a in r if a.name in ['OD1', 'OD2', 'OE1', 'OE2']]
    for p in pos_atoms:
        for n in neg_atoms:
            if p - n < 3.2:
                salt_bridges.add(p.get_parent())
                salt_bridges.add(n.get_parent())

    patch_properties = {}
    for res in surface_exposed:
        original_q = CHARGE_SCALE.get(res.resname, 0.0)
        if res in salt_bridges:
            patch_properties[res] = {'Q': original_q, 'H': normalize_kd('GLY')}
        else:
            patch_properties[res] = {'Q': original_q, 'H': normalize_kd(res.resname)}

    cdr_and_anchors = [r for r in surface_exposed if r.xtra.get('imgt_num') in IMGT_CDR_ANCHORS]
    total_cdr_length = sum(1 for c in model for r in c if r.xtra.get('imgt_num') and is_pure_imgt_cdr(r.xtra['imgt_num']))
    cdr3_length = sum(1 for c in model for r in c if r.xtra.get('imgt_num') and 105 <= r.xtra['imgt_num'] <= 117)

    h3_loop_coords = []
    h3_anchor_coords = []
    for r in vh_chain:
        imgt_num = r.xtra.get('imgt_num')
        if not imgt_num:
            continue
        backbone_atoms = [a.coord for a in r if a.name in ['N', 'CA', 'C']]
        if 105 <= imgt_num <= 117:
            h3_loop_coords.extend(backbone_atoms)
        if imgt_num in [102, 103, 118, 119]:
            h3_anchor_coords.extend(backbone_atoms)

    if h3_loop_coords and h3_anchor_coords:
        h_centroid = np.mean(h3_loop_coords, axis=0)
        c_centroid = np.mean(h3_anchor_coords, axis=0)
        rho = np.linalg.norm(h_centroid - c_centroid)
        compactness = (cdr3_length / rho) if rho > 0 else np.nan
    else:
        compactness = np.nan

    cdr_coords = [a.coord for r in cdr_and_anchors for a in r]
    vicinity = set(cdr_and_anchors)
    for res in surface_exposed:
        if res not in vicinity and [a.coord for a in res] and cdr_coords:
            if np.min(cdist([a.coord for a in res], cdr_coords)) <= 4.0:
                vicinity.add(res)
    vicinity_list = list(vicinity)
    psh, ppc, pnc = 0.0, 0.0, 0.0
    for i in range(len(vicinity_list)):
        for j in range(i + 1, len(vicinity_list)):
            r1, r2 = vicinity_list[i], vicinity_list[j]
            c1, c2 = [a.coord for a in r1], [a.coord for a in r2]
            if c1 and c2:
                r12 = float(np.min(cdist(c1, c2)))
                if 1e-6 < r12 < 7.5:
                    r12_sq = max(r12, 0.1) ** 2
                    psh += (patch_properties[r1]['H'] * patch_properties[r2]['H']) / r12_sq
                    q1, q2 = patch_properties[r1]['Q'], patch_properties[r2]['Q']
                    if q1 > 0 and q2 > 0:
                        ppc += (q1 * q2) / r12_sq
                    if q1 < 0 and q2 < 0:
                        pnc += (abs(q1) * abs(q2)) / r12_sq
    psh *= 2
    ppc *= 2
    pnc *= 2

    vhh_seq = vh_chain.xtra.get('sequence', '')
    vhh_residues = list(vh_chain.get_residues())
    prop_VHH = analyze_sequence(vhh_seq, vhh_residues, ptm_rsa_cutoff)

    return {
        'VH': vhh_seq,
        'Tetrad': tetrad_motif,
        'L': total_cdr_length,
        'L3': cdr3_length,
        'C': compactness,
        'PSH': psh,
        'PPC': ppc,
        'PNC': pnc,
        'prop_VHH': prop_VHH
    }


def _clean_aa(seq):
    return re.sub(r'[^ACDEFGHIKLMNPQRSTVWY]', '', (seq or '').strip().upper())


def check_seq_compatibility(new_seq, ref_seq, max_trim=6):
    ns = _clean_aa(new_seq)
    rs = _clean_aa(ref_seq)
    if not rs or ns == rs:
        return 'EXACT', ''
    short_s, long_s = (ns, rs) if len(ns) < len(rs) else (rs, ns)
    diff = len(long_s) - len(short_s)
    if short_s and diff <= max_trim and short_s in long_s:
        return 'TRIMMED', f"terminal trim diff={diff}aa (new={len(ns)}aa vs ref={len(rs)}aa)"
    return 'MISMATCH', f"sequence mismatch (new={len(ns)}aa vs ref={len(rs)}aa)"


def load_ref_metadata(ref_csv_path):
    meta_by_name = {}
    meta_by_seq = {}
    if not ref_csv_path or not os.path.exists(ref_csv_path):
        return meta_by_name, meta_by_seq
    try:
        with open(ref_csv_path, 'r', encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                fn = (row.get('Filename') or '').strip()
                vh = _clean_aa(row.get('VH') or '')
                if fn:
                    stem = os.path.splitext(fn)[0]
                    meta_by_name[fn] = row
                    meta_by_name[stem] = row
                    meta_by_name[stem.lower()] = row
                if vh:
                    meta_by_seq.setdefault(vh, []).append(row)
    except Exception:
        pass
    return meta_by_name, meta_by_seq


def _worker_task(task_tuple):
    filepath, psa_bin, ptm_rsa_cutoff = task_tuple
    try:
        res = process_single_structure(filepath, psa_bin, ptm_rsa_cutoff)
        return (filepath, True, res, "")
    except Exception as e:
        return (filepath, False, None, str(e))


def main():
    from concurrent.futures import ProcessPoolExecutor, as_completed

    parser = argparse.ArgumentParser(
        description="OPIG TNP (2025) Pure 3D Structure-Driven Nanobody Batch Developability & Gold-Standard 4-Tier PTM Calculator"
    )
    parser.add_argument("input", help="Input PDB/CIF file or directory containing 3D VHH structures (.pdb / .cif)")
    parser.add_argument("--output", "-o", help="Output CSV path (default: <input_dir>/result/Analysis_Results_TNP.csv)")
    parser.add_argument("--psa_bin", default="psa", help="Path to Joy 'psa' executable (default: psa)")
    parser.add_argument("--ref_csv", default="", help="Optional existing Analysis_Results_TNP.csv to auto-merge clinical & Genetics metadata")
    parser.add_argument("--strict_ref", action="store_true", help="Abort if any --ref_csv name match fails VHH sequence consistency validation")
    parser.add_argument("--ptm_rsa_cutoff", type=float, default=7.5, help="Side-chain RSA (%%) cutoff for surface exposure (default: 7.5)")
    parser.add_argument("--workers", "-j", type=int, default=max(1, min(8, os.cpu_count() or 1)), help="Number of parallel CPU worker processes")
    args = parser.parse_args()

    meta_by_name, meta_by_seq = load_ref_metadata(args.ref_csv)

    target_files = []
    input_abspath = os.path.abspath(args.input)
    if os.path.isdir(input_abspath):
        base_dir = input_abspath
        for root, dirs, files in os.walk(input_abspath):
            for f in files:
                if f.lower().endswith(('.pdb', '.cif')):
                    target_files.append(os.path.join(root, f))
    elif os.path.isfile(input_abspath):
        target_files.append(input_abspath)
        base_dir = os.path.dirname(input_abspath)
    else:
        print(f"[ERROR] Input path not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    target_files.sort(key=lambda x: os.path.basename(x).lower())
    total_files = len(target_files)
    if total_files == 0:
        print(f"[ERROR] No .pdb or .cif files found in: {args.input}", file=sys.stderr)
        sys.exit(1)

    if not args.output:
        result_dir = os.path.join(base_dir, 'result')
        os.makedirs(result_dir, exist_ok=True)
        args.output = os.path.join(result_dir, 'Analysis_Results_TNP.csv')
    else:
        out_dir = os.path.dirname(os.path.abspath(args.output))
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

    headers = [
        "Filename", "VH", "VL", "Genetics", "Highest_Clin_Trial", "Est. Status", "Year Proposed", "Year Recommended", "Target", "Status",
        "Tetrad", "L", "L3", "C", "PSH", "PPC", "PNC",
        "VHH_Length", "VHH_MW", "VHH_pI", "VHH_GRAVY", "VHH_Instability", "VHH_Charge", "VHH_NGlyc", "VHH_NGlycSites", "VHH_Deamidation", "VHH_Isomerization", "VHH_Oxidation", "VHH_Cys",
        "Error Message"
    ]

    print(f"[TNP 2025 Batch] Found {total_files} 3D structure(s). Running with {args.workers} worker(s)...")
    tasks = [(fp, args.psa_bin, args.ptm_rsa_cutoff) for fp in target_files]
    results_map = {}

    if args.workers <= 1 or total_files == 1:
        for idx, t in enumerate(tasks, 1):
            fp, ok, res, err = _worker_task(t)
            results_map[fp] = (ok, res, err)
            status_tag = "OK" if ok else f"FAIL ({err})"
            print(f"  [{idx}/{total_files}] {os.path.basename(fp)} -> {status_tag}", flush=True)
    else:
        done_count = 0
        with ProcessPoolExecutor(max_workers=args.workers) as executor:
            future_to_fp = {executor.submit(_worker_task, t): t[0] for t in tasks}
            for future in as_completed(future_to_fp):
                fp, ok, res, err = future.result()
                results_map[fp] = (ok, res, err)
                done_count += 1
                if done_count % 10 == 0 or done_count == total_files or not ok:
                    status_tag = "OK" if ok else f"FAIL ({err})"
                    print(f"  [{done_count}/{total_files}] {os.path.basename(fp)} -> {status_tag}", flush=True)

    success_count = 0
    fail_count = 0
    strict_ref_errors = []
    with open(args.output, 'w', newline='', encoding='utf-8') as csv_file:
        csv_writer = csv.writer(csv_file)
        csv_writer.writerow(headers)

        for filepath in target_files:
            raw_filename = os.path.basename(filepath)
            stem = os.path.splitext(raw_filename)[0]
            ok, res, err = results_map[filepath]

            meta = None
            name_candidate = (
                meta_by_name.get(raw_filename)
                or meta_by_name.get(stem)
                or meta_by_name.get(stem.lower())
            )
            if name_candidate:
                if ok and res:
                    vh_st, vh_msg = check_seq_compatibility(res.get('VH', ''), name_candidate.get('VH', ''))
                    if vh_st == 'MISMATCH':
                        warn_msg = f"[WARNING] {stem}: ref_csv name matched '{name_candidate.get('Filename')}' but failed sequence check (VHH {vh_msg}); metadata rejected."
                        print(warn_msg, file=sys.stderr, flush=True)
                        strict_ref_errors.append(warn_msg)
                        meta = None
                    else:
                        if vh_st == 'TRIMMED':
                            print(f"[INFO] {stem}: ref_csv matched '{name_candidate.get('Filename')}' with VHH {vh_msg}", flush=True)
                        meta = name_candidate
                else:
                    meta = name_candidate

            if not meta and ok and res:
                seq_key = _clean_aa(res.get('VH', ''))
                seq_candidates = meta_by_seq.get(seq_key, [])
                if len(seq_candidates) == 1:
                    meta = seq_candidates[0]
                elif len(seq_candidates) > 1:
                    dup_names = ", ".join(c.get('Filename', '?') for c in seq_candidates)
                    print(f"[WARNING] {stem}: sequence fallback matched multiple ref_csv entries ({dup_names}); skipping ambiguous metadata merge.", file=sys.stderr, flush=True)

            meta = meta or {}
            out_name = meta.get('Filename') or stem

            if ok and res:
                success_count += 1
                pH = res['prop_VHH']
                csv_writer.writerow([
                    out_name,
                    res.get('VH', meta.get('VH', '')),
                    meta.get('VL', ''),
                    meta.get('Genetics', ''),
                    meta.get('Highest_Clin_Trial', ''),
                    meta.get('Est. Status', ''),
                    meta.get('Year Proposed', ''),
                    meta.get('Year Recommended', ''),
                    meta.get('Target', ''),
                    "SUCCESS",
                    res['Tetrad'],
                    f"{res['L']:.0f}",
                    f"{res['L3']:.0f}",
                    f"{res['C']:.2f}" if not np.isnan(res['C']) else "NaN",
                    f"{res['PSH']:.2f}",
                    f"{res['PPC']:.2f}",
                    f"{res['PNC']:.2f}",
                    f"{pH['Length']}",
                    f"{pH.get('Mol_Weight', 0):.2f}",
                    f"{pH.get('pI', 0):.2f}",
                    f"{pH.get('GRAVY', 0):.3f}",
                    f"{pH.get('Instability', 0):.2f}",
                    f"{pH.get('Charge_pH7.4', 0):.2f}",
                    f"{pH.get('N_Glyco_Count', 0)}",
                    f"{pH.get('N_Glyco_Sites', '')}",
                    f"{pH.get('Deamidation', '')}",
                    f"{pH.get('Isomerization', '')}",
                    f"{pH.get('Oxidation', '')}",
                    f"{pH.get('Cys_Status', '')}",
                    ""
                ])
            else:
                fail_count += 1
                csv_writer.writerow([
                    out_name,
                    meta.get('VH', ''),
                    meta.get('VL', ''),
                    meta.get('Genetics', ''),
                    meta.get('Highest_Clin_Trial', ''),
                    meta.get('Est. Status', ''),
                    meta.get('Year Proposed', ''),
                    meta.get('Year Recommended', ''),
                    meta.get('Target', ''),
                    "FAILED"
                ] + [""] * 19 + [err])

    print(f"[TNP 2025 Batch] Completed! SUCCESS: {success_count}, FAILED: {fail_count}")
    print(f"[TNP 2025 Batch] Output saved to: {os.path.abspath(args.output)}")
    if args.strict_ref and strict_ref_errors:
        print(f"[ERROR] --strict_ref aborted with {len(strict_ref_errors)} sequence mismatch(es).", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()

