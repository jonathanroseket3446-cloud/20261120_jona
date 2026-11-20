import os
import sys
import shutil
import subprocess
from Bio.PDB import PDBParser, MMCIFParser

def get_chain_count(file_path):
    try:
        if file_path.lower().endswith('.cif'):
            parser = MMCIFParser(QUIET=True)
        else:
            parser = PDBParser(QUIET=True)
        structure = parser.get_structure('RAW', file_path)
        model = structure[0]
        # Count non-empty chains
        valid_chains = 0
        for chain in model:
            # Check if chain has any amino acid residues
            has_aa = False
            for res in chain:
                if res.id[0] == ' ': # standard residue
                    has_aa = True
                    break
            if has_aa:
                valid_chains += 1
        return valid_chains
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        return 0

def main():
    if len(sys.argv) < 3:
        print("Usage: python 03_auto_profiler.py <input_dir> <output_dir> [scripts_dir]")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    scripts_dir = sys.argv[3] if len(sys.argv) > 3 else os.path.dirname(os.path.abspath(__file__))
    
    tap_input = os.path.join(output_dir, 'tap_input')
    tnp_input = os.path.join(output_dir, 'tnp_input')
    
    os.makedirs(tap_input, exist_ok=True)
    os.makedirs(tnp_input, exist_ok=True)
    
    target_files = []
    for root, dirs, files in os.walk(input_dir):
        for f in files:
            if f.lower().endswith(('.pdb', '.cif')):
                target_files.append(os.path.join(root, f))
                
    has_tap = False
    has_tnp = False
                
    for f in target_files:
        count = get_chain_count(f)
        if count == 1:
            shutil.copy(f, os.path.join(tnp_input, os.path.basename(f)))
            has_tnp = True
        elif count > 1:
            shutil.copy(f, os.path.join(tap_input, os.path.basename(f)))
            has_tap = True
            
    # Run TAP
    if has_tap:
        subprocess.run(["python", os.path.join(scripts_dir, "TAP_2024_Batch.py"), tap_input, "-o", os.path.join(output_dir, "tap_results.csv")])
        
    # Run TNP
    if has_tnp:
        subprocess.run(["python", os.path.join(scripts_dir, "TNP_2025_Batch.py"), tnp_input, "-o", os.path.join(output_dir, "tnp_results.csv")])
        
    shutil.rmtree(tap_input)
    shutil.rmtree(tnp_input)

if __name__ == "__main__":
    main()
