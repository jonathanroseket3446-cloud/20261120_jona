#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import argparse
import logging
import pandas as pd
from pathlib import Path
import multiprocessing as mp
import queue 
import time
import biotite.structure.io as bsio
from tqdm import tqdm
import torch

torch.backends.cuda.matmul.allow_tf32 = True
torch.backends.cudnn.allow_tf32 = True

from ImmuneBuilder import ABodyBuilder2, NanoBodyBuilder2, TCRBuilder2

GLOBAL_WEIGHTS_DIR = "/share/users/zengxin/data/public_db/checkpoints/ImmuneBuilder/trained_model"

def parse_fasta_for_routing(fasta_path):
    seqs = {}
    current_chain = None
    with open(fasta_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"): continue
            if line.startswith(">"):
                header = line.upper()
                if header.endswith("_VH"): current_chain = "H"
                elif header.endswith("_VL"): current_chain = "L"
                elif header.endswith("_TCRA") or header.endswith("_TRA"): current_chain = "A"
                elif header.endswith("_TCRB") or header.endswith("_TRB"): current_chain = "B"
                else: current_chain = "H" 
            else:
                if current_chain:
                    seqs[current_chain] = seqs.get(current_chain, "") + line

    if "A" in seqs and "B" in seqs: return seqs, "TCR"
    if "H" in seqs and "L" in seqs: return seqs, "ABody"
    if "H" in seqs: return seqs, "Nano"
    return seqs, "Unknown"

def gpu_worker(worker_id, task_queue, result_queue, log_file):
    os.environ["OMP_NUM_THREADS"] = "1"
    os.environ["MKL_NUM_THREADS"] = "1"
    os.environ["OPENBLAS_NUM_THREADS"] = "1"
    os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
    os.environ["NUMEXPR_NUM_THREADS"] = "1"
    
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)

    local_rank = 0 
    time.sleep(worker_id * 5.0)
    
    logger = logging.getLogger(f"Worker_{worker_id}")
    logger.setLevel(logging.INFO)
    handler = logging.FileHandler(log_file)
    handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
    logger.addHandler(handler)

    models = {"ABody": None, "Nano": None, "TCR": None}

    try:
        torch.cuda.set_device(local_rank)
        logger.info(f"Worker {worker_id} started...")
    except Exception as e:
        logger.error(f"GPU {local_rank} fail: {e}")
        return

    while True:
        try:
            task = task_queue.get(timeout=3)
        except queue.Empty:
            continue

        if task is None: break

        fasta_path, output_path = Path(task[0]), Path(task[1])

        try:
            seq_dict, route = parse_fasta_for_routing(fasta_path)

            if route == "Unknown":
                result_queue.put({"file": fasta_path.name, "status": "Header Error"})
                continue

            if models[route] is None:
                try:
                    if route == "TCR": models[route] = TCRBuilder2(weights_dir=GLOBAL_WEIGHTS_DIR)
                    elif route == "ABody": models[route] = ABodyBuilder2(weights_dir=GLOBAL_WEIGHTS_DIR)
                    elif route == "Nano": models[route] = NanoBodyBuilder2(weights_dir=GLOBAL_WEIGHTS_DIR)
                except Exception as e:
                    result_queue.put({"file": fasta_path.name, "status": "Weight Load Error"})
                    continue

            with torch.inference_mode():
                out = models[route].predict(seq_dict)
            
            out.save(str(output_path))
            
            # Simple error parsing placeholder
            result_queue.put({"file": fasta_path.name, "pdb": str(output_path), "status": "OK"})
            
        except Exception as e:
            result_queue.put({"file": fasta_path.name, "status": f"Error: {str(e)[:20]}"})

        if torch.cuda.memory_reserved() > 0.85 * torch.cuda.get_device_properties(local_rank).total_memory:
            torch.cuda.empty_cache()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("fasta_dir", type=str)
    parser.add_argument("--output_dir", type=str, required=True)
    args = parser.parse_args()

    fasta_dir = Path(args.fasta_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    summary_file = output_dir / f"ib_summary_{fasta_dir.name}.csv"
    log_file = output_dir / f"ib_engine_{fasta_dir.name}.log"

    workers = 3
    fasta_extensions = {".fasta", ".fa", ".fas", ".txt"}
    fasta_files = [f for f in fasta_dir.iterdir() if f.is_file() and f.suffix.lower() in fasta_extensions]
    task_queue, result_queue = mp.Queue(), mp.Queue()
    
    to_do = []
    for f in fasta_files:
        out_pdb = output_dir / f"{f.stem}.pdb"
        to_do.append((str(f), str(out_pdb)))

    for t in to_do: task_queue.put(t)
    for _ in range(workers): task_queue.put(None)

    procs = []
    for i in range(workers):
        p = mp.Process(target=gpu_worker, args=(i, task_queue, result_queue, str(log_file)))
        p.start()
        procs.append(p)

    results = []
    while len(results) < len(to_do):
        try:
            res = result_queue.get(timeout=120)
            results.append(res)
        except queue.Empty:
            if not any(p.is_alive() for p in procs): break

    for p in procs:
        p.join(timeout=3)
        if p.is_alive(): p.terminate()
        
    pd.DataFrame(results).to_csv(summary_file, index=False)

if __name__ == "__main__":
    try:
        mp.set_start_method("forkserver", force=True)
    except RuntimeError:
        pass
    main()
