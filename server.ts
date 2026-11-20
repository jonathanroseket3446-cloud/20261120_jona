import express from "express";
import path from "path";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import { getGuidelines, syncGuidelines, saveGuidelines, resetGuidelines } from "./src/server/scraper";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { Client as SshClient } from "ssh2";

const serverDir = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({limit: "500mb"}));


app.get('/assets/therasabdab_vhvl_sequences.csv', (req, res) => {
  const file = path.join(process.cwd(), 'public', 'assets', 'therasabdab_vhvl_sequences.csv');
  res.download(file);
});

app.get('/assets/therasabdab_vhh_sequences.csv', (req, res) => {
  const file = path.join(process.cwd(), 'public', 'assets', 'therasabdab_vhh_sequences.csv');
  res.download(file);
});

import { computeGuidelines } from './src/server/stats';

app.get('/api/guidelines', (req, res) => {
  try {
    const tapStages = req.query.tapStages ? (req.query.tapStages as string).split(',') : [];
    const tnpStages = req.query.tnpStages ? (req.query.tnpStages as string).split(',') : [];
    const tapYears = req.query.tapYears ? (req.query.tapYears as string).split(',') : [];
    const tnpYears = req.query.tnpYears ? (req.query.tnpYears as string).split(',') : [];
    const tapTargets = req.query.tapTargets ? (req.query.tapTargets as string).split(',') : [];
    const tnpTargets = req.query.tnpTargets ? (req.query.tnpTargets as string).split(',') : [];
    const tapGenetics = req.query.tapGenetics ? (req.query.tapGenetics as string).split(',') : [];
    const tnpGenetics = req.query.tnpGenetics ? (req.query.tnpGenetics as string).split(',') : [];
    const data = computeGuidelines({ tapStages, tnpStages, tapYears, tnpYears, tapTargets, tnpTargets, tapGenetics, tnpGenetics });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reference/download/:type', (req, res) => {
  try {
    const { type } = req.params;
    const scriptsDir = findScriptsDir();
    if (type === 'tap_script' || type === 'script') {
      const scriptFile = path.join(scriptsDir, 'TAP_2024_Batch.py');
      return res.download(scriptFile, 'TAP_2024_Batch.py');
    }
    if (type === 'tnp_script') {
      const scriptFile = path.join(scriptsDir, 'TNP_2025_Batch.py');
      return res.download(scriptFile, 'TNP_2025_Batch.py');
    }
    const isTnp = type === 'tnp';
    const customPath = path.join(process.cwd(), isTnp ? 'uploads/custom_tnp.csv' : 'uploads/custom_tap.csv');
    const builtInPath = path.join(process.cwd(), isTnp ? 'src/server/data/Analysis_Results_TNP.csv' : 'src/server/data/Analysis_Results_TAP.csv');
    const targetPath = fs.existsSync(customPath) ? customPath : builtInPath;
    res.download(targetPath, isTnp ? 'Analysis_Results_TNP.csv' : 'Analysis_Results_TAP.csv');
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/guidelines/saved', (req, res) => {
  try {
    res.json(getGuidelines());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guidelines', (req, res) => {
  try {
    saveGuidelines(req.body);
    res.json(getGuidelines());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});




app.post('/api/guidelines/reset', (req, res) => {
  try {
    const customTapCsvPath = path.join(process.cwd(), 'uploads/custom_tap.csv');
    const customTnpCsvPath = path.join(process.cwd(), 'uploads/custom_tnp.csv');
    if (fs.existsSync(customTapCsvPath)) {
      fs.unlinkSync(customTapCsvPath);
    }
    if (fs.existsSync(customTnpCsvPath)) {
      fs.unlinkSync(customTnpCsvPath);
    }
    const data = computeGuidelines({});
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/guidelines/sync-therasabdab', async (req, res) => {
  const { urlThera } = req.body || {};
  try {
    let success = false;
    const csvPath = path.join(process.cwd(), 'therasabdab.csv');
    try {
      const { data } = await axios.get(urlThera || 'https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/static/downloads/TheraSAbDab_SeqStruc_OnlineDownload.csv', { timeout: 15000 });
      fs.writeFileSync(csvPath, data);
      success = true;
    } catch (err: any) {
      console.log('Failed to download TheraSAbDab CSV, falling back to local CSV', err.message);
      try {
        const localCsvPath = path.join(process.cwd(), '20260812_TheraSAbDab_SeqStruc_OnlineDownload.csv');
        const altLocalCsvPath = path.join(process.cwd(), 'TheraSAbDab_SeqStruc_OnlineDownload.csv');
        if (fs.existsSync(localCsvPath)) {
          fs.copyFileSync(localCsvPath, csvPath);
          success = true;
        } else if (fs.existsSync(altLocalCsvPath)) {
          fs.copyFileSync(altLocalCsvPath, csvPath);
          success = true;
        } else {
          console.log('Local CSV not found either.');
        }
      } catch (err2: any) {
        console.log('Failed to copy local CSV', err2.message);
      }
    }

    if (success) {
      execSync('python3 process_therasabdab.py', { cwd: process.cwd() });
    } else {
      throw new Error('Failed to update Sequence Properties from remote or local fallback.');
    }

    const defaultData = fs.readFileSync(path.join(process.cwd(), 'src/server/default_therasabdab.json'), 'utf-8');
    const stats = JSON.parse(defaultData);
    
    // Merge with existing guidelines
    const current = getGuidelines();
    current.therasabdab = stats;
    current.therasabdabLastSynced = new Date().toISOString();
    saveGuidelines(current);
    
    res.json(current);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guidelines/sync', async (req, res) => {
  const { urlTAP, urlTNP } = req.body || {};
  try {
    const data = await syncGuidelines(urlTAP, urlTNP);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const upload = multer({ dest: 'uploads/' });

app.post('/api/upload/tap', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const dest = path.join(process.cwd(), 'uploads', 'custom_tap.csv');
    fs.renameSync(req.file.path, dest);
    // invalidate cache
    res.json(computeGuidelines({}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload/tnp', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const dest = path.join(process.cwd(), 'uploads', 'custom_tnp.csv');
    fs.renameSync(req.file.path, dest);
    res.json(computeGuidelines({}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload/reset', (req, res) => {
  try {
    const tapDest = path.join(process.cwd(), 'uploads', 'custom_tap.csv');
    const tnpDest = path.join(process.cwd(), 'uploads', 'custom_tnp.csv');
    if (fs.existsSync(tapDest)) fs.unlinkSync(tapDest);
    if (fs.existsSync(tnpDest)) fs.unlinkSync(tnpDest);
    res.json(computeGuidelines({}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const execSSH = (ssh: SshClient, cmd: string, stdin?: string): Promise<{ code: number, out: string, errOut: string }> => {
  return new Promise((resolve, reject) => {
    ssh.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '', errOut = '';
      stream.on('data', (d: any) => out += d.toString());
      stream.stderr.on('data', (d: any) => errOut += d.toString());
      stream.on('close', (code: any) => resolve({ code, out, errOut }));
      if (stdin) {
        stream.write(stdin);
        stream.end();
      }
    });
  });
};

const uploadBase64ViaSsh = async (ssh: SshClient, remotePath: string, b64: string) => {
  const finishRes = await execSSH(ssh, `base64 -d > "${remotePath}"`, b64);
  if (finishRes.code !== 0) {
    throw new Error(`Failed to decode uploaded file ${remotePath}: ${finishRes.errOut}`);
  }
};

const uploadContentViaSsh = async (ssh: SshClient, remotePath: string, content: string | Buffer): Promise<void> => {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const b64 = buffer.toString('base64');
  
  // Use chunked echo to avoid ARG_MAX limits on very large files, then decode
  const chunkSize = 32 * 1024; // 32KB chunks to be safe for ssh command length limits
  
  let initCmd = `mkdir -p "$(dirname "${remotePath}")" && rm -f "${remotePath}.b64"`;
  let initRes = await execSSH(ssh, initCmd);
  if (initRes.code !== 0) throw new Error(`Failed to init upload for ${remotePath}: ${initRes.errOut}`);
  
  for (let i = 0; i < b64.length; i += chunkSize) {
    const chunk = b64.slice(i, i + chunkSize);
    const writeRes = await execSSH(ssh, `echo -n '${chunk}' >> "${remotePath}.b64"`);
    if (writeRes.code !== 0) throw new Error(`Failed to write chunk for ${remotePath}: ${writeRes.errOut}`);
  }
  
  const finishRes = await execSSH(ssh, `base64 -d "${remotePath}.b64" > "${remotePath}" && rm -f "${remotePath}.b64"`);
  if (finishRes.code !== 0) {
    throw new Error(`Failed to decode uploaded file ${remotePath}: ${finishRes.errOut}`);
  }
};

const findScriptsDir = (): string => {
  const candidateDirs = [
    path.join(process.cwd(), 'src/server/scripts'),
    path.join(process.cwd(), 'server/scripts'),
    path.join(serverDir, 'src/server/scripts'),
    path.join(serverDir, 'server/scripts'),
    path.join(serverDir, 'scripts'),
    path.join(process.cwd(), 'scripts')
  ];
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(process.cwd(), 'src/server/scripts');
};

let globalSshConfig: any = null;

async function withSSH<T>(callback: (ssh: SshClient) => Promise<T>): Promise<T> {
  if (!globalSshConfig) {
    throw new Error("SSH Config is missing. Please connect/save settings first.");
  }
  const ssh = new SshClient();
  
  try {
    await new Promise<void>((resolve, reject) => {
      ssh.on('ready', resolve).on('error', reject).connect({
        host: globalSshConfig.sshHost,
        port: parseInt(globalSshConfig.sshPort || "22", 10),
        username: globalSshConfig.sshUser,
        password: globalSshConfig.sshPass,
        readyTimeout: 15000,
      });
    });
    return await callback(ssh);
  } finally {
    try { ssh.end(); } catch (e) {}
    try { ssh.destroy(); } catch (e) {}
  }
}

// Basic health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get('/api/ssh/status', async (req, res) => {
  if (!globalSshConfig) {
    return res.json({ connected: false });
  }
  try {
    await withSSH(async () => {});
    res.json({ connected: true });
  } catch (e) {
    res.json({ connected: false });
  }
});

app.post('/api/ssh/connect', async (req, res) => {
  try {
    globalSshConfig = req.body;
    await withSSH(async (ssh) => {
      await execSSH(ssh, 'echo "Test Connection"');
    });
    res.json({ success: true, message: 'SSH Connection Established' });
  } catch (error: any) {
    globalSshConfig = null;
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/ssh/disconnect', async (req, res) => {
  globalSshConfig = null;
  res.json({ success: true, message: 'SSH Connection Closed' });
});

app.post('/api/reference/calibrate-ssh', async (req, res) => {
  try {
    const { mode, type, remotePdbDir = '', remoteBasePath, condaProfile, ibEnv, psaBin, ptmRsaCutoff = 7.5 } = req.body || {};
    const resolvedBasePath = remoteBasePath || globalSshConfig?.remoteBasePath;
    if (!resolvedBasePath) {
      return res.status(400).json({ error: 'Remote Base Path is required.' });
    }
    const cleanPdbDir = String(remotePdbDir || '').trim();
    if (!cleanPdbDir) {
      return res.status(400).json({
        error: 'Remote 3D PDB Directory is required. Pure 3D reference profiling (ANARCI + 3D DSSP + PSA) requires 3D .pdb/.cif structure files.'
      });
    }
    const resolvedMode = mode || type || 'TAP';
    const isTnp = String(resolvedMode).toUpperCase() === 'TNP';
    const scriptName = isTnp ? 'TNP_2025_Batch.py' : 'TAP_2024_Batch.py';
    const scriptsDir = findScriptsDir();
    const calScriptPath = path.join(scriptsDir, scriptName);
    if (!fs.existsSync(calScriptPath)) {
      return res.status(500).json({ error: `${scriptName} not found on server.` });
    }
    const localCsvPath = path.join(process.cwd(), isTnp ? 'src/server/data/Analysis_Results_TNP.csv' : 'src/server/data/Analysis_Results_TAP.csv');
    const remoteCalDir = `${resolvedBasePath}/calibration_${isTnp ? 'tnp' : 'tap'}`;
    let logOutput = '';

    await withSSH(async (ssh) => {
      await execSSH(ssh, `mkdir -p "${remoteCalDir}"`);
      const scriptContent = fs.readFileSync(calScriptPath, 'utf-8');
      const csvContent = fs.readFileSync(localCsvPath, 'utf-8');
      await uploadContentViaSsh(ssh, `${remoteCalDir}/${scriptName}`, scriptContent);
      await uploadContentViaSsh(ssh, `${remoteCalDir}/input_ref.csv`, csvContent);

      const envSetup = condaProfile ? `source ${condaProfile} && conda activate ${ibEnv || 'immunebuilder'} && ` : '';
      const psaArg = psaBin ? `--psa_bin "${psaBin}"` : '';
      const cmd = `${envSetup}python "${remoteCalDir}/${scriptName}" "${cleanPdbDir}" --ref_csv "${remoteCalDir}/input_ref.csv" -o "${remoteCalDir}/calibrated_out.csv" ${psaArg} --ptm_rsa_cutoff ${Number(ptmRsaCutoff) || 7.5}`;
      const runRes = await execSSH(ssh, cmd);
      logOutput = (runRes.out + '\n' + runRes.errOut).trim();
      if (runRes.code !== 0) {
        throw new Error(`Remote 3D profiling failed: ${runRes.errOut || runRes.out}`);
      }
      const catRes = await execSSH(ssh, `cat "${remoteCalDir}/calibrated_out.csv"`);
      if (catRes.code !== 0 || !catRes.out.trim()) {
        throw new Error('Calibrated CSV output was empty on remote server.');
      }
      fs.writeFileSync(localCsvPath, catRes.out, 'utf-8');
    });

    const updatedGuidelines = computeGuidelines({});
    res.json({
      success: true,
      log: logOutput,
      guidelines: updatedGuidelines
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/submit", async (req, res) => {
  try {
    const { 
      remoteBasePath, condaProfile, ibEnv, psaBin, ptmRsaCutoff = 7.5,
      mode, projectId, zipPayload
    } = req.body;
    
    if (!remoteBasePath) {
      return res.status(400).json({ error: "Remote Base Path is required. Please check your settings." });
    }

    if (!zipPayload) {
      return res.status(400).json({ error: "No files uploaded (zipPayload missing)" });
    }

    const safeProjectId = projectId ? String(projectId).replace(/[^a-zA-Z0-9_-]/g, '_') : 'batch_' + Date.now();
    const batchId = safeProjectId;
    const batchPath = `${remoteBasePath}/jobs/${batchId}`;

    await withSSH(async (ssh) => {
      const mkdirRes = await execSSH(ssh, `mkdir -p "${batchPath}/scripts" "${batchPath}/input" "${batchPath}/result" "${batchPath}/logs"`);
      if (mkdirRes.code !== 0) {
        throw new Error(`Failed to create directories on remote server (${mkdirRes.errOut || 'Permission or path error'})`);
      }
      
      const guidelines = getGuidelines();
      const scrapedThresholds = guidelines.tap;
      const tnpThresholds = guidelines.tnp;
      
      const scriptsDir = findScriptsDir();
      console.log(`[Submit] Using scripts directory: ${scriptsDir}`);
  
      // Check and Upload Scripts
      const localScripts = ['02_immunebuilder_submit_stage1.py', 'TAP_2024_Batch.py', 'TNP_2025_Batch.py', '03_auto_profiler.py'];
      for (const script of localScripts) {
        const scriptPath = path.join(scriptsDir, script);
        if (fs.existsSync(scriptPath)) {
           let content = fs.readFileSync(scriptPath, 'utf-8');
           if (script === 'TAP_2024_Batch.py' && scrapedThresholds) {
             content = content.replace(
               /THRESHOLDS_2024_ABB2 = \{[\s\S]*?\n\}/,
               `THRESHOLDS_2024_ABB2 = ${JSON.stringify(scrapedThresholds, null, 4)}`
             );
           }
           if (script === 'TNP_2025_Batch.py' && tnpThresholds) {
             content = content.replace(
               /THRESHOLDS_TNP = \{[\s\S]*?\n\}/,
               `THRESHOLDS_TNP = ${JSON.stringify(tnpThresholds, null, 4)}`
             );
           }
           
           if (script === 'TAP_2024_Batch.py' || script === 'TNP_2025_Batch.py') {
             if (psaBin) {
               content = content.replace(
                 /parser\.add_argument\("--psa_bin", default="[^"]*"/,
                 `parser.add_argument("--psa_bin", default="${psaBin}"`
               );
             }
             if (guidelines.therasabdab) {
               content = content.replace(
                 /THRESHOLDS_THERASABDAB = \{\}/,
                 `THRESHOLDS_THERASABDAB = ${JSON.stringify(guidelines.therasabdab, null, 4)}`
               );
             }
           }
           console.log(`[Submit] Uploading script ${script} -> ${batchPath}/scripts/${script}`);
           await uploadContentViaSsh(ssh, `${batchPath}/scripts/${script}`, content);
        } else {
           console.error(`[Submit] WARNING: Script ${script} not found at ${scriptPath}`);
        }
      }
  
      // Upload input files via Base64 Zip
      console.log(`[Submit] Uploading and extracting zipped input files to ${batchPath}/input/`);
      const uploadZipRes = await execSSH(
        ssh, 
        `cd "${batchPath}/input" && base64 -d > targets.zip && unzip -o targets.zip && rm targets.zip`, 
        zipPayload
      );
      if (uploadZipRes.code !== 0) {
         console.error(`[Submit] ZIP Extract Error: ${uploadZipRes.errOut}`);
         throw new Error('Failed to extract zipped payload on the remote server.');
      }
      
      await execSSH(ssh, `chmod +x "${batchPath}/scripts/"* 2>/dev/null || true`);
      
      // Launch jobs asynchronously
      const envSetup = condaProfile ? `source ${condaProfile} && conda activate ${ibEnv || 'immunebuilder'}` : '';
      let scriptContent = `#!/bin/bash
${envSetup}
echo "Starting job for batch ${batchId}"
`;
      const psaFlag = psaBin ? ` --psa_bin "${psaBin}"` : '';
      const rsaCutoffVal = Number(ptmRsaCutoff) || 7.5;
      const profilerFlags = `--ptm_rsa_cutoff ${rsaCutoffVal}${psaFlag}`;

      if (mode === "fasta") {
        scriptContent += `python "${batchPath}/scripts/02_immunebuilder_submit_stage1.py" "${batchPath}/input" --output_dir "${batchPath}/result"
python "${batchPath}/scripts/03_auto_profiler.py" "${batchPath}/result" "${batchPath}/result" "${batchPath}/scripts" ${profilerFlags}
`;
      } else if (mode === "structure") {
        scriptContent += `python "${batchPath}/scripts/03_auto_profiler.py" "${batchPath}/input" "${batchPath}/result" "${batchPath}/scripts" ${profilerFlags}
`;
      }
      scriptContent += `rm -rf "${batchPath}/scripts"\n`;

      await uploadContentViaSsh(ssh, `${batchPath}/scripts/run.sh`, scriptContent);
      await execSSH(ssh, `chmod +x "${batchPath}/scripts/run.sh"`);
      await execSSH(ssh, `nohup bash "${batchPath}/scripts/run.sh" > "${batchPath}/logs/run.log" 2>&1 &`);
    });
    
    res.json({ success: true, message: "Job submitted successfully", batchId });
  } catch (error: any) {
    console.error("Error submitting job:", error);
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/jobs/:batchId/results', async (req, res) => {
  try {
    const { batchId } = req.params;
    const remoteBasePath = req.query.remoteBasePath as string;
    const batchPath = `${remoteBasePath}/jobs/${batchId}`;

    let tapCsv = '';
    let tnpCsv = '';

    await withSSH(async (ssh) => {
      // Check if tap_results.csv exists
      try {
        const { out: tapOut } = await execSSH(ssh, `cat "${batchPath}/result/tap_results.csv" 2>/dev/null || echo ""`);
        tapCsv = tapOut;
      } catch(e) {}
  
      // Check if tnp_results.csv exists
      try {
        const { out: tnpOut } = await execSSH(ssh, `cat "${batchPath}/result/tnp_results.csv" 2>/dev/null || echo ""`);
        tnpCsv = tnpOut;
      } catch(e) {}
    });

    res.json({ tapCsv, tnpCsv });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs', async (req, res) => {
  try {
    const { remoteBasePath } = req.body;
    if (!remoteBasePath) throw new Error("remoteBasePath required");
    
    // Status Logic:
    // We check /jobs directory, get batch IDs, their files in input/, and their completion state.
        // For ImmuneBuilder, check if result/xxxx.pdb exists or result/ib_summary_input.csv exists.
    // For Structure, check if tap_results.csv or tnp_results.csv exists.
    
    const statusScript = `
cd "${remoteBasePath}/jobs" 2>/dev/null || exit 0
echo "===TARGETS==="
for b in $(ls -1t | head -n 10); do
  if [ -d "$b/input" ]; then
    for f in "$b"/input/*; do
      [ -e "$f" ] || continue
      target=$(basename "$f")
      target_noext="\${target%.*}"
      is_completed=0
      status="Unknown"
      
      # ImmuneBuilder Logic
      if [ -f "$b/result/$target_noext.pdb" ]; then
        is_completed=1
      # Structure Profiler Logic
      elif [ -f "$b/result/tap_results.csv" ] || [ -f "$b/result/tnp_results.csv" ]; then
        is_completed=1
      fi
      
      if [ "$is_completed" -eq 0 ]; then
         if pgrep -u $USER -f "$b" > /dev/null; then
            status="Running"
         else
            status="Failed/Stopped"
         fi
      fi
      
      echo "$b|$target|$is_completed|$status"
    done
  fi
done`;
    
    const { out } = await withSSH(async (ssh) => {
      return await execSSH(ssh, statusScript);
    });
    const parts = out.split('===TARGETS===');
    const targetsRaw = parts[1]?.trim() || parts[0]?.replace('===TARGETS===', '').trim();

    const batches = new Map<string, any>();
    if (targetsRaw) {
      targetsRaw.split('\n').forEach(line => {
        if (!line.trim()) return;
        const [batchId, target, isCompleted, runStatus] = line.split('|');
        if (!batches.has(batchId)) {
          batches.set(batchId, { id: batchId, createdAt: batchId.replace('batch_', ''), targets: [] });
        }
        
        let status = runStatus;
        if (isCompleted === '1') {
          status = 'Completed';
        }

        batches.get(batchId).targets.push({ name: target, status });
      });
    }

    res.json(Array.from(batches.values()));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jobs/:batchId/delete', async (req, res) => {
  try {
    const { remoteBasePath } = req.body;
    const { batchId } = req.params;
    const batchPath = `${remoteBasePath}/jobs/${batchId}`;
    
    await withSSH(async (ssh) => {
      // Kill local processes (IB, Profiler) and remove directory
      await execSSH(ssh, `pkill -f "${batchId}" 2>/dev/null || true`);
      await execSSH(ssh, `rm -rf "${batchPath}"`);
    });
    res.json({ success: true });
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});


app.get('/api/jobs/:batchId/download/:targetName', async (req, res) => {
  try {
    req.setTimeout(0);
    res.setTimeout(0);
    
    const remoteBasePath = req.query.remoteBasePath as string;
    const downloadType = req.query.type as string;
    const { batchId, targetName } = req.params;
    const batchPath = `${remoteBasePath}/jobs/${batchId}`;

    const typeName = downloadType === 'all' ? 'all' : 'results';
    res.setHeader('Content-Disposition', `attachment; filename="${targetName}_${typeName}.tar.gz"`);
    res.setHeader('Content-Type', 'application/gzip');
    res.flushHeaders();

    // For target download, we just download the result/targetName directory
    await withSSH(async (ssh) => {
      await new Promise<void>((resolve, reject) => {
        let tarCommand = `cd "${batchPath}/result" && LIST=$(mktemp) && find . -maxdepth 1 -name "*${targetName.replace(/\.[^/.]+$/, "")}*" > "$LIST" && tar -czf - -T "$LIST" && rm -f "$LIST"`;
        if (downloadType === 'results') {
          tarCommand = `cd "${batchPath}/result" && LIST=$(mktemp) && find . -maxdepth 1 -type f \\( -name "*${targetName.replace(/\.[^/.]+$/, "")}*.pdb" -o -name "*.csv" \\) > "$LIST" && tar -czf - -T "$LIST" && rm -f "$LIST"`;
        }
        ssh.exec(tarCommand, (err, stream) => {
          if (err) {
            if (!res.headersSent) res.status(500).send('Failed to start download stream.');
            return reject(err);
          }
          stream.pipe(res);
          stream.on('close', () => resolve());
          stream.on('error', reject);
        });
      });
    });
  } catch (error: any) {
    if (!res.headersSent) res.status(500).send(error.message);
  }
});


app.post('/api/jobs/:batchId/cancel/:targetName', async (req, res) => {
  try {
    const { remoteBasePath } = req.body;
    const { batchId, targetName } = req.params;
    const batchPath = `${remoteBasePath}/jobs/${batchId}`;
    await withSSH(async (ssh) => {
      // Remove input file to prevent further processing if not yet started
      await execSSH(ssh, `rm -f "${batchPath}/input/${targetName}"`);
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jobs/:batchId/delete/:targetName', async (req, res) => {
  try {
    const { remoteBasePath } = req.body;
    const { batchId, targetName } = req.params;
    const batchPath = `${remoteBasePath}/jobs/${batchId}`;
    
    // Extact stem without extension
    const targetStem = targetName.replace(/\.[^/.]+$/, "");
    
    await withSSH(async (ssh) => {
      await execSSH(ssh, `rm -f "${batchPath}/input/${targetName}"`);
      await execSSH(ssh, `rm -rf "${batchPath}/result/${targetStem}"`);
      await execSSH(ssh, `rm -f "${batchPath}/result/${targetStem}.pdb"`);
      await execSSH(ssh, `rm -f "${batchPath}/logs/"*_AF3MSA_${targetStem}.out "${batchPath}/logs/"*_AF3MSA_${targetStem}.err "${batchPath}/logs/"*_AF3Fold_${targetStem}.out "${batchPath}/logs/"*_AF3Fold_${targetStem}.err 2>/dev/null || true`);
      
      // Check if empty
      await execSSH(ssh, `if [ -z "$(ls -1 ${batchPath}/input/*.* 2>/dev/null)" ]; then pkill -f "${batchId}" 2>/dev/null || true; rm -rf "${batchPath}"; fi`);
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs/:batchId/cancel', async (req, res) => {
  try {
    const { remoteBasePath } = req.body;
    const { batchId } = req.params;
    
    await withSSH(async (ssh) => {
      // Kill processes associated with this batch ID
      await execSSH(ssh, `pkill -f "${batchId}" 2>/dev/null || true`);
    });
    res.json({ success: true });
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs/:batchId/download', async (req, res) => {
  try {
    req.setTimeout(0);
    res.setTimeout(0);
    
    const remoteBasePath = req.query.remoteBasePath as string;
    const downloadType = req.query.type as string;
    const { batchId } = req.params;
    
    const batchPath = `${remoteBasePath}/jobs/${batchId}`;
    
    await withSSH(async (ssh) => {
      const check = await execSSH(ssh, `[ -d "${batchPath}" ] && echo "YES" || echo "NO"`);
      if (check.out.trim() !== 'YES') {
        res.status(404).send('Batch directory not found.');
        return;
      }
  
      const typeName = downloadType === 'all' ? 'all' : 'results';
      res.setHeader('Content-Disposition', `attachment; filename="${batchId}_${typeName}.tar.gz"`);
      res.setHeader('Content-Type', 'application/gzip');
      res.flushHeaders();
  
      let tarCommand = `cd "${batchPath}" && LIST=$(mktemp) && find . -type f > "$LIST" && tar -czf - -T "$LIST" && rm -f "$LIST"`;
      if (downloadType === 'results') {
        tarCommand = `cd "${batchPath}" && LIST=$(mktemp) && find result -type f \\( -name "*.pdb" -o -name "*.csv" \\) > "$LIST" && tar -czf - -T "$LIST" && rm -f "$LIST"`;
      }
  
      await new Promise<void>((resolve, reject) => {
        ssh.exec(tarCommand, (err, stream) => {
          if (err) {
            if (!res.headersSent) res.status(500).send('Failed to start download stream.');
            return reject(err);
          }
          stream.pipe(res);
          stream.on('close', () => resolve());
          stream.on('error', reject);
        });
      });
    });
  } catch (error: any) {
    if (!res.headersSent) res.status(500).send(error.message);
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
