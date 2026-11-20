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
    Residues participating in parallel/antiparallel beta-bridges/ladders (E/B)
    or alpha/3_10/pi helices (H/G/I) are marked 'Strand' (hydrogen-bond locked);
    turns, bends, and unbonded coils (T/S/C) are marked 'Loop'.
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
            # Skip amide H placement across chain breaks
            if np.linalg.norm(coords_N[i] - coords_C[i - 1]) > 2.5:
                continue
            co_vec = coords_C[i - 1] - coords_O[i - 1]
            norm = np.linalg.norm(co_vec)
            if norm > 1e-6:
                coords_H[i] = coords_N[i] + 1.01 * (co_vec / norm)

    # Kabsch-Sander H-bond matrix: hbond[donor_i (N-H), acceptor_j (C=O)] = True
    # Standard DSSP Top-2 rule: each N-H donor and each C=O acceptor retains at most
    # the 2 lowest-energy H-bonds with E < -0.5 kcal/mol.
    q1q2_f = 0.42 * 0.20 * 332.0  # 27.888 kcal*A/mol
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
            # Parallel bridge: [Bond(i-1, j) & Bond(j, i+1)] or [Bond(j-1, i) & Bond(i, j+1)]
            par1 = hbond[j, i - 1] and hbond[i + 1, j]
            par2 = hbond[i, j - 1] and hbond[j + 1, i]
            # Antiparallel bridge: [Bond(i, j) & Bond(j, i)] or [Bond(i-1, j+1) & Bond(j-1, i+1)]
            anti1 = hbond[j, i] and hbond[i, j]
            anti2 = hbond[j + 1, i - 1] and hbond[i + 1, j - 1]
            if par1 or par2 or anti1 or anti2:
                is_strand_or_helix[i] = True
                is_strand_or_helix[j] = True

    # Helices (consecutive n-turns for n in 3, 4, 5): Bond(i, i+n) == hbond[i+n, i]
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
    """
    Pure 3D structure-driven site state evaluation:
    - Regional identity ('CDR' vs 'FR') directly from ANARCI IMGT number on 3D residue
    - Secondary structure ('Loop' vs 'Strand') directly from 3D Kabsch-Sander DSSP H-bonds
    - Surface exposure ('Exp' vs 'Buried') directly from PSA side_rsa >= ptm_rsa_cutoff
      on the reactive residue (pos) itself.
    """
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
    """
    Gold Standard 4-Tier Deamidation (Nx) with overlapping lookahead scan:
    - Tier 2 High risk: NG (exposed & in loops)
    - Tier 3 Moderate risk: NS, NT, NN, NH (exposed & in loops)
    - Tier 4 Low risk: all other 15 Nx (including NP) when exposed & in loops
    - Protected: CORE_DEAMIDATION_MOTIFS when on beta-strands or buried
    """
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
    """
    Gold Standard 4-Tier Isomerization (Dx) with overlapping lookahead scan:
    - Tier 2 High risk: DG (exposed & in loops)
    - Tier 3 Moderate risk: DS, DD (exposed & in loops)
    - Tier 4 Low risk: all other 17 Dx (including DP, DT, DH) when exposed & in loops
    - Protected: CORE_ISOMERIZATION_MOTIFS when on beta-strands or buried
    """
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


def _extract_cys_entries(sequence, chain_residues, chain_tag):
    entries = []
    for m in re.finditer(r'C', sequence):
        pos = m.start() + 1
        idx = pos - 1
        res = chain_residues[idx] if (chain_residues is not None and 0 <= idx < len(chain_residues)) else None
        sg = np.array(res['SG'].get_coord(), dtype=float) if (res is not None and 'SG' in res) else None
        cb = np.array(res['CB'].get_coord(), dtype=float) if (res is not None and 'CB' in res) else None
        ca = np.array(res['CA'].get_coord(), dtype=float) if (res is not None and 'CA' in res) else None
        imgt_num = res.xtra.get('imgt_num') if res is not None else None
        imgt_label = (res.xtra.get('imgt_label') or str(imgt_num or pos)) if res is not None else str(pos)
        entries.append({
            'chain': chain_tag,
            'pos': pos,
            'imgt_num': imgt_num,
            'imgt_label': imgt_label,
            'sg': sg,
            'cb': cb,
            'ca': ca,
            'residues': chain_residues
        })
    return entries


def _disulfide_pair_distance(a, b):
    """
    Combined 3D geometric disulfide-bond criterion resilient to ImmuneBuilder/OpenMM
    unbonded relaxation while preserving strict stereochemical specificity:
      1. Both SG present: SG-SG <= 3.5 A; OR (CB-CB <= 5.0 A and SG-SG <= 5.5 A);
         OR same-chain canonical IMGT 23-104 with CA-CA <= 7.5 A.
      2. SG missing on either residue, both CB present: CB-CB <= 4.8 A;
         OR same-chain canonical IMGT 23-104 with CA-CA <= 7.5 A.
      3. Only CA present: same-chain canonical IMGT 23-104 with CA-CA <= 7.5 A.
    Returns effective pair distance (float) if valid disulfide, else None.
    """
    d_sg = float(np.linalg.norm(a['sg'] - b['sg'])) if (a['sg'] is not None and b['sg'] is not None) else None
    d_cb = float(np.linalg.norm(a['cb'] - b['cb'])) if (a['cb'] is not None and b['cb'] is not None) else None
    d_ca = float(np.linalg.norm(a['ca'] - b['ca'])) if (a['ca'] is not None and b['ca'] is not None) else None
    is_canonical_23_104 = (
        a['chain'] == b['chain']
        and {a['imgt_num'], b['imgt_num']} == {23, 104}
    )

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
    """
    Strict 1-to-1 disulfide pairing maximizing pair count and minimizing total distance.
    Uses exact bitmask DP when len(cys_entries) <= 16 (typical Fv has 2-8 Cys),
    falling back to minimum-distance greedy 1-to-1 matching for larger counts.
    Returns list of (idx_i, idx_j, dist) pairs.
    """
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
                edges.append((dist, 0 if cys_entries[i]['chain'] == cys_entries[j]['chain'] else 1, i, j))

    if not edges:
        return []

    if m <= 16:
        memo = {}

        def solve(mask):
            if mask in memo:
                return memo[mask]
            # Find first unpaired node with at least one available neighbor
            first = -1
            for i in range(m):
                if not (mask & (1 << i)):
                    first = i
                    break
            if first == -1:
                res = (0, 0.0, ())
                memo[mask] = res
                return res

            # Option 1: leave `first` unpaired
            best = solve(mask | (1 << first))
            # Option 2: pair `first` with any available neighbor j
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

    # Greedy minimum-distance 1-to-1 fallback for > 16 Cys
    edges.sort(key=lambda x: (x[0], x[1]))
    used = set()
    pairs = []
    for dist, _, i, j in edges:
        if i not in used and j not in used:
            used.add(i)
            used.add(j)
            pairs.append((i, j, dist))
    return pairs


def evaluate_fv_cysteines(seq_H, res_H, seq_L, res_L, ptm_rsa_cutoff=7.5):
    """
    Evaluates intra-chain and inter-chain (ds-scFv, e.g. VH IMGT49 <-> VL IMGT120)
    3D disulfide bonds across the full Fv with strict 1-to-1 pairing.
    Returns (cys_status_H, cys_status_L, cys_status_HL).
    """
    clean_H = re.sub(r'[^ACDEFGHIKLMNPQRSTVWY]', '', (seq_H or '').strip().upper())
    clean_L = re.sub(r'[^ACDEFGHIKLMNPQRSTVWY]', '', (seq_L or '').strip().upper())

    entries_H = _extract_cys_entries(clean_H, res_H, 'VH')
    entries_L = _extract_cys_entries(clean_L, res_L, 'VL')
    all_entries = entries_H + entries_L

    pairs = match_disulfides_1to1(all_entries)
    paired_indices = set()
    inter_H_labels = []
    inter_L_labels = []
    inter_HL_labels = []

    for i, j, _ in pairs:
        paired_indices.add(i)
        paired_indices.add(j)
        ea, eb = all_entries[i], all_entries[j]
        if ea['chain'] != eb['chain']:
            vh_e, vl_e = (ea, eb) if ea['chain'] == 'VH' else (eb, ea)
            vh_lbl = f"{vh_e['pos']}@IMGT{vh_e['imgt_label']}(C)"
            vl_lbl = f"{vl_e['pos']}@IMGT{vl_e['imgt_label']}(C)"
            inter_H_labels.append(f"{vh_lbl}-VL:{vl_lbl}")
            inter_L_labels.append(f"{vl_lbl}-VH:{vh_lbl}")
            inter_HL_labels.append(f"VH:{vh_lbl}-VL:{vl_lbl}")

    free_H_tokens = []
    free_L_tokens = []
    free_HL_tokens = []
    n_H = len(entries_H)

    for idx, entry in enumerate(all_entries):
        if idx not in paired_indices:
            tok = format_site_token(entry['pos'], 'C', entry['residues'], ptm_rsa_cutoff)
            if idx < n_H:
                free_H_tokens.append(tok)
                free_HL_tokens.append(f"VH:{tok}")
            else:
                free_L_tokens.append(tok)
                free_HL_tokens.append(f"VL:{tok}")

    def _fmt_status(count, free_toks, inter_lbls):
        if count == 0:
            return "0 (Free: No)"
        if free_toks:
            return f"{count} (Free: Yes @ {'; '.join(free_toks)})"
        if inter_lbls:
            return f"{count} (Free: No; Inter-chain: {'; '.join(inter_lbls)})"
        return f"{count} (Free: No)"

    status_H = _fmt_status(len(entries_H), free_H_tokens, inter_H_labels)
    status_L = _fmt_status(len(entries_L), free_L_tokens, inter_L_labels)
    status_HL = _fmt_status(len(all_entries), free_HL_tokens, inter_HL_labels)
    return status_H, status_L, status_HL


def check_free_cysteine(sequence, chain_residues, ptm_rsa_cutoff=7.5):
    entries = _extract_cys_entries(sequence, chain_residues, 'CHAIN')
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
            free_tokens.append(
                format_site_token(entry['pos'], 'C', chain_residues, ptm_rsa_cutoff)
            )

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


def split_ptm_tokens(val_str):
    if not val_str or str(val_str).strip() in ('', 'None'):
        return []
    return [s.strip() for s in re.split(r',\s*(?![^\[\]]*\])', str(val_str)) if s.strip() and s.strip() != 'None']


def combine_ptm_sites(val_H, val_L):
    parts = []
    for s in split_ptm_tokens(val_H):
        parts.append(f"VH:{s}")
    for s in split_ptm_tokens(val_L):
        parts.append(f"VL:{s}")
    return ', '.join(parts) if parts else "None"


def combine_cys_status(clean_H, clean_L, cys_status_H, cys_status_L):
    cys_tot = clean_H.count('C') + clean_L.count('C')
    if cys_tot == 0:
        return "0 (Free: No)"
    free_parts = []
    m_H = re.search(r'Free:\s*Yes(?:\s*@\s*(.+))?\)\s*$', str(cys_status_H or '').strip())
    if m_H:
        if m_H.group(1):
            for tok in m_H.group(1).split(';'):
                if tok.strip():
                    free_parts.append(f"VH:{tok.strip()}")
        else:
            free_parts.append("VH:Unpaired")
    m_L = re.search(r'Free:\s*Yes(?:\s*@\s*(.+))?\)\s*$', str(cys_status_L or '').strip())
    if m_L:
        if m_L.group(1):
            for tok in m_L.group(1).split(';'):
                if tok.strip():
                    free_parts.append(f"VL:{tok.strip()}")
        else:
            free_parts.append("VL:Unpaired")
    if free_parts:
        return f"{cys_tot} (Free: Yes @ {'; '.join(free_parts)})"
    return f"{cys_tot} (Free: No)"


def calc_two_chain_pi(clean_H, clean_L):
    if not clean_H and not clean_L:
        return 0.0
    if not clean_H:
        return round(ProteinAnalysis(clean_L).isoelectric_point(), 2)
    if not clean_L:
        return round(ProteinAnalysis(clean_H).isoelectric_point(), 2)
    pa_H = ProteinAnalysis(clean_H)
    pa_L = ProteinAnalysis(clean_L)
    min_ph, max_ph = 1.0, 14.0
    for _ in range(25):
        mid = (min_ph + max_ph) / 2.0
        net_charge = pa_H.charge_at_pH(mid) + pa_L.charge_at_pH(mid)
        if net_charge > 0:
            min_ph = mid
        else:
            max_ph = mid
    return round((min_ph + max_ph) / 2.0, 2)


def analyze_combined_fv(seq_H, seq_L, prop_H, prop_L, cys_status_override=None):
    clean_H = re.sub(r'[^ACDEFGHIKLMNPQRSTVWY]', '', (seq_H or '').strip().upper())
    clean_L = re.sub(r'[^ACDEFGHIKLMNPQRSTVWY]', '', (seq_L or '').strip().upper())
    l_H = prop_H.get('Length', 0)
    l_L = prop_L.get('Length', 0)
    l_tot = l_H + l_L
    if l_tot == 0:
        return {'Length': 0, 'Mol_Weight': 0.0, 'pI': 0.0, 'GRAVY': 0.0, 'Instability': 0.0, 'Charge_pH7.4': 0.0, 'N_Glyco_Count': 0, 'N_Glyco_Sites': 'None', 'Deamidation': 'None', 'Isomerization': 'None', 'Oxidation': 'None', 'Cys_Status': 'None'}

    mw_fv = round(prop_H.get('Mol_Weight', 0.0) + prop_L.get('Mol_Weight', 0.0), 2)
    pi_fv = calc_two_chain_pi(clean_H, clean_L)
    gravy_fv = round((l_H * prop_H.get('GRAVY', 0.0) + l_L * prop_L.get('GRAVY', 0.0)) / l_tot, 3)
    inst_fv = round((l_H * prop_H.get('Instability', 0.0) + l_L * prop_L.get('Instability', 0.0)) / l_tot, 2)
    charge_fv = round(prop_H.get('Charge_pH7.4', 0.0) + prop_L.get('Charge_pH7.4', 0.0), 2)
    nglyc_count_fv = prop_H.get('N_Glyco_Count', 0) + prop_L.get('N_Glyco_Count', 0)
    cys_status_fv = (
        cys_status_override
        if cys_status_override is not None
        else combine_cys_status(clean_H, clean_L, prop_H.get('Cys_Status', ''), prop_L.get('Cys_Status', ''))
    )

    return {
        'Length': l_tot,
        'Mol_Weight': mw_fv,
        'pI': pi_fv,
        'GRAVY': gravy_fv,
        'Instability': inst_fv,
        'Charge_pH7.4': charge_fv,
        'N_Glyco_Count': nglyc_count_fv,
        'N_Glyco_Sites': combine_ptm_sites(prop_H.get('N_Glyco_Sites', 'None'), prop_L.get('N_Glyco_Sites', 'None')),
        'Deamidation': combine_ptm_sites(prop_H.get('Deamidation', 'None'), prop_L.get('Deamidation', 'None')),
        'Isomerization': combine_ptm_sites(prop_H.get('Isomerization', 'None'), prop_L.get('Isomerization', 'None')),
        'Oxidation': combine_ptm_sites(prop_H.get('Oxidation', 'None'), prop_L.get('Oxidation', 'None')),
        'Cys_Status': cys_status_fv
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
        chain.xtra['chain_type'] = 'H' if h_count > l_count else 'L'
        chain.xtra['sequence'] = seq

        # Exact contiguous substring alignment (prevents misaligning IMGT numbers onto N-terminal tags)
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

        # Compute 3D secondary structure (Strand vs Loop) from PDB backbone H-bonds
        assign_3d_secondary_structure(residues)

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
    vh_charge = sum([CHARGE_SCALE.get(r.resname, 0.0) for r in surface_exposed if r.get_parent().xtra.get('chain_type') == 'H'])
    vl_charge = sum([CHARGE_SCALE.get(r.resname, 0.0) for r in surface_exposed if r.get_parent().xtra.get('chain_type') == 'L'])
    sfvcsp = vh_charge * vl_charge
    if abs(sfvcsp) < 1e-9:
        sfvcsp = 0.0
    seq_H = ""
    seq_L = ""
    res_H = None
    res_L = None
    for c in model:
        if c.xtra.get('chain_type') == 'H' and res_H is None:
            seq_H = c.xtra.get('sequence', '')
            res_H = list(c.get_residues())
        if c.xtra.get('chain_type') == 'L' and res_L is None:
            seq_L = c.xtra.get('sequence', '')
            res_L = list(c.get_residues())

    if not seq_H or not res_H:
        raise ValueError("No VH chain detected in 3D structure (TAP requires both VH and VL)")
    if not seq_L or not res_L:
        raise ValueError("No VL chain detected in 3D structure (TAP requires both VH and VL)")

    prop_H = analyze_sequence(seq_H, res_H, ptm_rsa_cutoff)
    prop_L = analyze_sequence(seq_L, res_L, ptm_rsa_cutoff)

    # Unified 1-to-1 Fv 3D disulfide pairing (intra-chain + inter-chain VH-VL ds-scFv)
    cys_H, cys_L, cys_HL = evaluate_fv_cysteines(seq_H, res_H, seq_L, res_L, ptm_rsa_cutoff)
    prop_H['Cys_Status'] = cys_H
    prop_L['Cys_Status'] = cys_L
    prop_HL = analyze_combined_fv(seq_H, seq_L, prop_H, prop_L, cys_status_override=cys_HL)

    return {
        'VH': seq_H,
        'VL': seq_L,
        'L_tot': total_cdr_length,
        'PSH': psh,
        'PPC': ppc,
        'PNC': pnc,
        'SFvCSP': sfvcsp,
        'prop_H': prop_H,
        'prop_L': prop_L,
        'prop_HL': prop_HL
    }


def _clean_aa(seq):
    return re.sub(r'[^ACDEFGHIKLMNPQRSTVWY]', '', (seq or '').strip().upper())


def check_seq_compatibility(new_seq, ref_seq, max_trim=6):
    """
    Validates whether a newly extracted chain sequence matches a reference CSV sequence:
      - 'EXACT': identical (or ref_seq empty)
      - 'TRIMMED': exact contiguous substring differing by <= max_trim terminal residues
      - 'MISMATCH': internal divergence or length difference > max_trim
    """
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
                vl = _clean_aa(row.get('VL') or '')
                if fn:
                    stem = os.path.splitext(fn)[0]
                    meta_by_name[fn] = row
                    meta_by_name[stem] = row
                    meta_by_name[stem.lower()] = row
                if vh and vl:
                    meta_by_seq.setdefault((vh, vl), []).append(row)
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
        description="OPIG TAP (2024) Pure 3D Structure-Driven Batch Developability & Gold-Standard 4-Tier PTM Calculator"
    )
    parser.add_argument("input", help="Input PDB/CIF file or directory containing 3D antibody structures (.pdb / .cif)")
    parser.add_argument("--output", "-o", help="Output CSV path (default: <input_dir>/result/Analysis_Results_TAP.csv)")
    parser.add_argument("--psa_bin", default="psa", help="Path to Joy 'psa' executable (default: psa)")
    parser.add_argument("--ref_csv", default="", help="Optional existing Analysis_Results_TAP.csv to auto-merge clinical & Genetics metadata")
    parser.add_argument("--strict_ref", action="store_true", help="Abort if any --ref_csv name match fails VH/VL sequence consistency validation")
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
        args.output = os.path.join(result_dir, 'Analysis_Results_TAP.csv')
    else:
        out_dir = os.path.dirname(os.path.abspath(args.output))
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

    headers = [
        "Filename", "VH", "VL", "Genetics", "Highest_Clin_Trial", "Est. Status", "Year Proposed", "Year Recommended", "Target", "Status",
        "Total CDR Length (L_tot)", "PSH", "PPC", "PNC", "SFvCSP",
        "VH_Length", "VH_MW", "VH_pI", "VH_GRAVY", "VH_Instability", "VH_Charge", "VH_NGlyc", "VH_NGlycSites", "VH_Deamidation", "VH_Isomerization", "VH_Oxidation", "VH_Cys",
        "VL_Length", "VL_MW", "VL_pI", "VL_GRAVY", "VL_Instability", "VL_Charge", "VL_NGlyc", "VL_NGlycSites", "VL_Deamidation", "VL_Isomerization", "VL_Oxidation", "VL_Cys",
        "VHVL_Length", "VHVL_MW", "VHVL_pI", "VHVL_GRAVY", "VHVL_Instability", "VHVL_Charge", "VHVL_NGlyc", "VHVL_NGlycSites", "VHVL_Deamidation", "VHVL_Isomerization", "VHVL_Oxidation", "VHVL_Cys",
        "Error Message"
    ]

    print(f"[TAP 2024 Batch] Found {total_files} 3D structure(s). Running with {args.workers} worker(s)...")
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
                if done_count % 25 == 0 or done_count == total_files or not ok:
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
                    vl_st, vl_msg = check_seq_compatibility(res.get('VL', ''), name_candidate.get('VL', ''))
                    if vh_st == 'MISMATCH' or vl_st == 'MISMATCH':
                        reason = "; ".join(p for p in [f"VH {vh_msg}" if vh_st == 'MISMATCH' else "", f"VL {vl_msg}" if vl_st == 'MISMATCH' else ""] if p)
                        warn_msg = f"[WARNING] {stem}: ref_csv name matched '{name_candidate.get('Filename')}' but failed sequence check ({reason}); metadata rejected."
                        print(warn_msg, file=sys.stderr, flush=True)
                        strict_ref_errors.append(warn_msg)
                        meta = None
                    else:
                        if vh_st == 'TRIMMED' or vl_st == 'TRIMMED':
                            info_detail = "; ".join(p for p in [f"VH {vh_msg}" if vh_st == 'TRIMMED' else "", f"VL {vl_msg}" if vl_st == 'TRIMMED' else ""] if p)
                            print(f"[INFO] {stem}: ref_csv matched '{name_candidate.get('Filename')}' with {info_detail}", flush=True)
                        meta = name_candidate
                else:
                    meta = name_candidate

            if not meta and ok and res:
                seq_key = (_clean_aa(res.get('VH', '')), _clean_aa(res.get('VL', '')))
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
                pH = res['prop_H']
                pL = res['prop_L']
                pHL = res['prop_HL']
                csv_writer.writerow([
                    out_name,
                    res.get('VH', meta.get('VH', '')),
                    res.get('VL', meta.get('VL', '')),
                    meta.get('Genetics', ''),
                    meta.get('Highest_Clin_Trial', ''),
                    meta.get('Est. Status', ''),
                    meta.get('Year Proposed', ''),
                    meta.get('Year Recommended', ''),
                    meta.get('Target', ''),
                    "SUCCESS",
                    f"{res['L_tot']:.0f}",
                    f"{res['PSH']:.2f}",
                    f"{res['PPC']:.2f}",
                    f"{res['PNC']:.2f}",
                    f"{res['SFvCSP']:.2f}",
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
                    f"{pL['Length']}",
                    f"{pL.get('Mol_Weight', 0):.2f}",
                    f"{pL.get('pI', 0):.2f}",
                    f"{pL.get('GRAVY', 0):.3f}",
                    f"{pL.get('Instability', 0):.2f}",
                    f"{pL.get('Charge_pH7.4', 0):.2f}",
                    f"{pL.get('N_Glyco_Count', 0)}",
                    f"{pL.get('N_Glyco_Sites', '')}",
                    f"{pL.get('Deamidation', '')}",
                    f"{pL.get('Isomerization', '')}",
                    f"{pL.get('Oxidation', '')}",
                    f"{pL.get('Cys_Status', '')}",
                    f"{pHL['Length']}",
                    f"{pHL.get('Mol_Weight', 0):.2f}",
                    f"{pHL.get('pI', 0):.2f}",
                    f"{pHL.get('GRAVY', 0):.3f}",
                    f"{pHL.get('Instability', 0):.2f}",
                    f"{pHL.get('Charge_pH7.4', 0):.2f}",
                    f"{pHL.get('N_Glyco_Count', 0)}",
                    f"{pHL.get('N_Glyco_Sites', '')}",
                    f"{pHL.get('Deamidation', '')}",
                    f"{pHL.get('Isomerization', '')}",
                    f"{pHL.get('Oxidation', '')}",
                    f"{pHL.get('Cys_Status', '')}",
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
                ] + [""] * 41 + [err])

    print(f"[TAP 2024 Batch] Completed! SUCCESS: {success_count}, FAILED: {fail_count}")
    print(f"[TAP 2024 Batch] Output saved to: {os.path.abspath(args.output)}")
    if args.strict_ref and strict_ref_errors:
        print(f"[ERROR] --strict_ref aborted with {len(strict_ref_errors)} sequence mismatch(es).", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()

