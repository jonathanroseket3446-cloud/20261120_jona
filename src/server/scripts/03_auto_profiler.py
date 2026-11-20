#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import os
import sys
import shutil
import subprocess
from collections import Counter
from Bio.PDB import PDBParser, MMCIFParser


def get_chain_count(file_path):
    try:
        if file_path.lower().endswith('.cif'):
            parser = MMCIFParser(QUIET=True)
        else:
            parser = PDBParser(QUIET=True)
        structure = parser.get_structure('RAW', file_path)
        model = structure[0]
        valid_chains = 0
        for chain in model:
            has_aa = False
            for res in chain:
                if res.id[0] == ' ':  # standard residue
                    has_aa = True
                    break
            if has_aa:
                valid_chains += 1
        return valid_chains
    except Exception as e:
        print(f"Error parsing {file_path}: {e}", file=sys.stderr)
        return 0


def build_unique_dest_name(filepath, input_dir, basename_counts, used_names):
    """
    Preserves the original basename when unique; when multiple subdirectories
    contain files with the same basename, encodes the relative path to prevent
    silent overwrites in the staged directory.
    """
    base = os.path.basename(filepath)
    if basename_counts[base.lower()] == 1 and base.lower() not in used_names:
        used_names.add(base.lower())
        return base

    rel = os.path.relpath(filepath, input_dir)
    rel_flat = rel.replace(os.sep, '__')
    if os.altsep:
        rel_flat = rel_flat.replace(os.altsep, '__')
    stem, ext = os.path.splitext(rel_flat)
    candidate = f"{stem}{ext}"
    suffix = 2
    while candidate.lower() in used_names:
        candidate = f"{stem}_{suffix}{ext}"
        suffix += 1
    used_names.add(candidate.lower())
    return candidate


def main():
    parser = argparse.ArgumentParser(
        description="Auto-routes 1-chain VHH structures to TNP_2025_Batch.py and multi-chain Fv structures to TAP_2024_Batch.py"
    )
    parser.add_argument("input_dir", help="Input directory containing .pdb / .cif structures")
    parser.add_argument("output_dir", help="Output directory for tap_results.csv / tnp_results.csv")
    parser.add_argument(
        "scripts_dir",
        nargs="?",
        default=os.path.dirname(os.path.abspath(__file__)),
        help="Optional directory containing TAP_2024_Batch.py and TNP_2025_Batch.py"
    )
    parser.add_argument("--psa_bin", default="", help="Path to Joy 'psa' executable forwarded to batch scripts")
    parser.add_argument("--ptm_rsa_cutoff", type=float, default=7.5, help="Side-chain RSA (%%) cutoff forwarded to batch scripts (default: 7.5)")
    parser.add_argument("--workers", "-j", type=int, default=None, help="Optional parallel worker count forwarded to batch scripts")
    args = parser.parse_args()

    input_dir = os.path.abspath(args.input_dir)
    output_dir = os.path.abspath(args.output_dir)
    scripts_dir = os.path.abspath(args.scripts_dir)

    tap_input = os.path.join(output_dir, 'tap_input')
    tnp_input = os.path.join(output_dir, 'tnp_input')

    os.makedirs(tap_input, exist_ok=True)
    os.makedirs(tnp_input, exist_ok=True)

    target_files = []
    for root, dirs, files in os.walk(input_dir):
        # Avoid re-scanning our own staging directories when input_dir == output_dir
        dirs[:] = [d for d in dirs if os.path.abspath(os.path.join(root, d)) not in (tap_input, tnp_input)]
        for f in files:
            if f.lower().endswith(('.pdb', '.cif')):
                target_files.append(os.path.join(root, f))

    target_files.sort()
    basename_counts = Counter(os.path.basename(f).lower() for f in target_files)
    used_tap_names = set()
    used_tnp_names = set()

    has_tap = False
    has_tnp = False

    try:
        for f in target_files:
            count = get_chain_count(f)
            if count == 1:
                dest_name = build_unique_dest_name(f, input_dir, basename_counts, used_tnp_names)
                shutil.copy2(f, os.path.join(tnp_input, dest_name))
                has_tnp = True
            elif count > 1:
                dest_name = build_unique_dest_name(f, input_dir, basename_counts, used_tap_names)
                shutil.copy2(f, os.path.join(tap_input, dest_name))
                has_tap = True

        extra_flags = ["--ptm_rsa_cutoff", str(args.ptm_rsa_cutoff)]
        if args.psa_bin:
            extra_flags.extend(["--psa_bin", args.psa_bin])
        if args.workers is not None and args.workers > 0:
            extra_flags.extend(["--workers", str(args.workers)])

        if has_tap:
            cmd = [
                sys.executable,
                os.path.join(scripts_dir, "TAP_2024_Batch.py"),
                tap_input,
                "-o",
                os.path.join(output_dir, "tap_results.csv"),
                *extra_flags
            ]
            subprocess.run(cmd, check=True)

        if has_tnp:
            cmd = [
                sys.executable,
                os.path.join(scripts_dir, "TNP_2025_Batch.py"),
                tnp_input,
                "-o",
                os.path.join(output_dir, "tnp_results.csv"),
                *extra_flags
            ]
            subprocess.run(cmd, check=True)
    finally:
        if os.path.exists(tap_input):
            shutil.rmtree(tap_input, ignore_errors=True)
        if os.path.exists(tnp_input):
            shutil.rmtree(tnp_input, ignore_errors=True)


if __name__ == "__main__":
    main()
