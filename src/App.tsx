import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileType,
  CheckCircle,
  Play,
  Settings,
  List,
  Link,
  FileText,
  Terminal,
  Cpu,
  WifiOff,
  BookOpen,
  Download,
  Database,
  Layers
} from 'lucide-react';
import axios from 'axios';
import { Toaster, toast } from 'sonner';
import Tasks from './components/Tasks';
import Docs from './components/Docs';
import Guidelines from './components/Guidelines';
import InfoTooltip from './components/InfoTooltip';

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'settings' | 'tasks' | 'guidelines' | 'docs'>('upload');

  // Settings State
  const [sshHost, setSshHost] = useState(localStorage.getItem('sshHost') || '1.2.268.1.100');
  const [sshPort, setSshPort] = useState(localStorage.getItem('sshPort') || '22');
  const [sshUser, setSshUser] = useState(localStorage.getItem('sshUser') || '');
  const [sshPass, setSshPass] = useState(localStorage.getItem('sshPass') || '');
  const [remoteBasePath, setRemoteBasePath] = useState(
    localStorage.getItem('remoteBasePath') || '/share/users/zengxin/workspace/TAP_TNP'
  );
  const [condaProfile, setCondaProfile] = useState(
    localStorage.getItem('condaProfile') || '/share/software/miniforge3/etc/profile.d/conda.sh'
  );
  const [ibEnv, setIbEnv] = useState(localStorage.getItem('ibEnv') || 'immunebuilder');
  const [psaBin, setPsaBin] = useState(
    localStorage.getItem('psaBin') || '/share/users/zengxin/data/AI_tools/TNP/bin/psa'
  );
  const [sshConnected, setSshConnected] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Reference 3D Calibration State
  const [remoteTapPdbDir, setRemoteTapPdbDir] = useState(localStorage.getItem('remoteTapPdbDir') || '');
  const [remoteTnpPdbDir, setRemoteTnpPdbDir] = useState(localStorage.getItem('remoteTnpPdbDir') || '');
  const [ptmRsaCutoff, setPtmRsaCutoff] = useState(localStorage.getItem('ptmRsaCutoff') || '7.5');
  const [calibratingType, setCalibratingType] = useState<'tap' | 'tnp' | null>(null);
  const [calibrationLog, setCalibrationLog] = useState<string>('');

  // Save settings on change
  useEffect(() => {
    localStorage.setItem('sshHost', sshHost);
    localStorage.setItem('sshPort', sshPort);
    localStorage.setItem('sshUser', sshUser);
    localStorage.setItem('sshPass', sshPass);
    localStorage.setItem('remoteBasePath', remoteBasePath);
    localStorage.setItem('condaProfile', condaProfile);
    localStorage.setItem('ibEnv', ibEnv);
    localStorage.setItem('psaBin', psaBin);
    localStorage.setItem('remoteTapPdbDir', remoteTapPdbDir);
    localStorage.setItem('remoteTnpPdbDir', remoteTnpPdbDir);
    localStorage.setItem('ptmRsaCutoff', ptmRsaCutoff);
  }, [
    sshHost,
    sshPort,
    sshUser,
    sshPass,
    remoteBasePath,
    condaProfile,
    ibEnv,
    psaBin,
    remoteTapPdbDir,
    remoteTnpPdbDir,
    ptmRsaCutoff
  ]);

  const runRemoteCalibration = async (type: 'tap' | 'tnp') => {
    const remotePdbDir = type === 'tap' ? remoteTapPdbDir.trim() : remoteTnpPdbDir.trim();
    if (!remotePdbDir) {
      toast.error(`Please specify the Remote ${type.toUpperCase()} 3D PDB Directory first (pure 3D pipeline requires .pdb/.cif structures).`);
      return;
    }
    let isConnected = sshConnected;
    if (!isConnected) {
      isConnected = await connectSsh();
      if (!isConnected) return;
    }
    setCalibratingType(type);
    setCalibrationLog(`Starting remote ${type.toUpperCase()} 3D reference profiling via SSH (ANARCI + 3D DSSP + PSA)...`);
    try {
      const res = await axios.post('/api/reference/calibrate-ssh', {
        type,
        mode: type.toUpperCase(),
        remoteBasePath,
        remotePdbDir,
        condaProfile,
        ibEnv,
        psaBin,
        ptmRsaCutoff: parseFloat(ptmRsaCutoff) || 7.5
      });
      setCalibrationLog(res.data.log || '3D Reference profiling completed.');
      toast.success(`${type.toUpperCase()} Reference DB 3D-profiled and synced!`);
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      setCalibrationLog(`Error: ${msg}`);
      toast.error(`3D Reference profiling failed: ${msg}`);
    } finally {
      setCalibratingType(null);
    }
  };

  const uploadCustomReference = async (type: 'tap' | 'tnp', file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post('/api/upload/' + type, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Successfully uploaded custom reference file. Guidelines updated.');
      setRefreshKey(prev => prev + 1);
    } catch (e: any) {
      toast.error('Failed to upload: ' + (e.response?.data?.error || e.message));
    }
  };

  const resetToolchainPaths = () => {
    setRemoteBasePath('/share/users/zengxin/workspace/TAP_TNP');
    setCondaProfile('/share/software/miniforge3/etc/profile.d/conda.sh');
    setIbEnv('immunebuilder');
    setPsaBin('/share/users/zengxin/data/AI_tools/TNP/bin/psa');
    setPtmRsaCutoff('7.5');
    toast.success('Toolchain paths reset to defaults (SSH credentials preserved).');
  };

  const resetCustomReferenceCsvs = async () => {
    try {
      await axios.post('/api/upload/reset');
      toast.success('Restored built-in TAP & TNP reference databases.');
      setRefreshKey(prev => prev + 1);
    } catch (e: any) {
      toast.error('Failed to reset reference CSVs: ' + (e.response?.data?.error || e.message));
    }
  };

  const connectSsh = async (): Promise<boolean> => {
    try {
      await axios.post('/api/ssh/connect', {
        sshHost,
        sshPort,
        sshUser,
        sshPass,
        remoteBasePath
      });
      setSshConnected(true);
      return true;
    } catch (err: any) {
      setSshConnected(false);
      toast.error('Failed to connect via SSH: ' + (err.response?.data?.message || err.message));
      return false;
    }
  };

  const disconnectSsh = async () => {
    try {
      await axios.post('/api/ssh/disconnect');
      setSshConnected(false);
    } catch (err) {
      toast.error('Failed to disconnect SSH.');
    }
  };

  useEffect(() => {
    if (sshHost && sshUser && sshPass) {
      axios
        .get('/api/ssh/status')
        .then(res => {
          setSshConnected(res.data.connected);
        })
        .catch(() => setSshConnected(false));
    }
  }, []);

  // Job State
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<'fasta' | 'structure'>('fasta');
  const [isDragging, setIsDragging] = useState(false);

  const generateRandomId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return 'proj_' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };
  const [projectId, setProjectId] = useState<string>(generateRandomId());

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('Please upload files first.');
      return;
    }
    if (!remoteBasePath) {
      toast.error('Remote Base Path is required. Please configure it in settings.');
      setActiveTab('settings');
      return;
    }

    let isConnected = sshConnected;
    if (!isConnected) {
      isConnected = await connectSsh();
      if (!isConnected) return;
    }

    setIsSubmitting(true);

    try {
      const zipData: Record<string, Uint8Array> = {};
      for (const file of files) {
        const buf = await file.arrayBuffer();
        zipData[file.name] = new Uint8Array(buf);
      }

      const { zipSync } = await import('fflate');
      const zipped = zipSync(zipData);

      const chunks: string[] = [];
      const chunkSize = 8192;
      for (let i = 0; i < zipped.length; i += chunkSize) {
        chunks.push(String.fromCharCode.apply(null, Array.from(zipped.subarray(i, i + chunkSize))));
      }
      const zipPayload = btoa(chunks.join(''));

      await axios.post('/api/submit', {
        zipPayload,
        remoteBasePath,
        condaProfile,
        ibEnv,
        psaBin,
        mode,
        projectId
      });
      toast.success('Job submitted successfully!');
      setActiveTab('tasks');
      setFiles([]);
      setProjectId(generateRandomId());
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message;
      if (
        typeof errorMsg === 'string' &&
        (errorMsg.includes('SSH Client is not connected') || errorMsg.includes('SSH Config is missing'))
      ) {
        setSshConnected(false);
        const retryConnected = await connectSsh();
        if (retryConnected) {
          try {
            const formData = new FormData();
            files.forEach(f => {
              formData.append('files', f);
            });
            formData.append('remoteBasePath', remoteBasePath);
            formData.append('condaProfile', condaProfile);
            formData.append('ibEnv', ibEnv);
            formData.append('psaBin', psaBin);
            formData.append('mode', mode);
            formData.append('projectId', projectId);

            await axios.post('/api/submit', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Job submitted successfully!');
            setActiveTab('tasks');
            setFiles([]);
            setProjectId(generateRandomId());
            return;
          } catch (retryErr: any) {
            toast.error('Error submitting job: ' + (retryErr.response?.data?.error || retryErr.message));
            return;
          }
        }
      }
      toast.error('Error submitting job: ' + errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col text-surface-900">
      <Toaster position="top-right" richColors />

      {/* Unified Scientific Header Bar */}
      <header className="bg-white border-b border-surface-200 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-xs">
            <FileType className="text-white w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-base font-bold text-surface-900 font-display tracking-tight">
              Therapeutic Antibody Profiler_IB
            </h1>
            <span className="text-brand-600 text-[11px] font-bold font-mono bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
              v3.5
            </span>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1 bg-surface-100 p-1 rounded-xl border border-surface-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-white text-surface-900 shadow-xs'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <UploadCloud size={14} />
            Pipeline
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'tasks'
                ? 'bg-white text-surface-900 shadow-xs'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <Layers size={14} />
            Results
          </button>
          <button
            onClick={() => setActiveTab('guidelines')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'guidelines'
                ? 'bg-white text-surface-900 shadow-xs'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <BookOpen size={14} />
            Guidelines
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'docs'
                ? 'bg-white text-surface-900 shadow-xs'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <FileText size={14} />
            Docs
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-white text-surface-900 shadow-xs'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <Settings size={14} />
            Settings
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('settings')}
            className="flex items-center gap-2 text-xs font-mono font-semibold bg-surface-50 hover:bg-surface-100 px-3 py-1.5 rounded-lg border border-surface-200 transition-colors"
            title="Configure SSH Cluster Connection"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                sshConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-rose-500'
              }`}
            />
            <span className="text-surface-700">{sshConnected ? 'SSH ONLINE' : 'SSH OFFLINE'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'settings' && (
          <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
            {/* Section 1: SSH Connection */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-surface-200">
              <div className="border-b border-surface-200 pb-4 mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-brand-50 rounded-lg border border-brand-100">
                    <Settings size={18} className="text-brand-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-surface-900 font-display flex items-center gap-1.5">
                      HPC Cluster SSH Connection
                      <InfoTooltip
                        title="SSH Remote Execution (远程算力集群连接)"
                        description="通过标准 SSH 协议连接至您的 Linux 高性能计算节点（HPC 或 GPU 服务器），远程调度 ImmuneBuilder 深度学习三维结构建模、ANARCI IMGT 免疫球蛋白编号、3D Kabsch-Sander (DSSP) 主链氢键二级结构识别以及 Joy PSA 侧链溶剂可及表面积计算。"
                        method="输入集群 IP/域名、SSH 端口（默认 22）、用户名与密码后点击 Connect。系统会建立持久化的 SSH 会话池，并在顶栏实时显示 SSH ONLINE / OFFLINE 状态。"
                        example="例如：Host = 192.168.1.100, Port = 22, Username = zengxin。连接成功后即可在 Pipeline 页面一键提交批量序列或 PDB 文件进行远程自动化剖析。"
                      />
                    </h2>
                    <p className="text-xs text-surface-500">Remote execution node credentials</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={connectSsh}
                    className="text-xs bg-surface-900 hover:bg-surface-800 transition-colors text-white px-3.5 py-2 rounded-lg flex items-center gap-1.5 font-semibold"
                  >
                    <Link size={13} /> Connect
                  </button>
                  <button
                    onClick={disconnectSsh}
                    disabled={!sshConnected}
                    className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 disabled:opacity-40 transition-colors px-3.5 py-2 rounded-lg flex items-center gap-1.5 font-semibold"
                  >
                    <WifiOff size={13} /> Disconnect
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Host</label>
                  <input
                    type="text"
                    value={sshHost}
                    onChange={e => setSshHost(e.target.value)}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 focus:bg-white focus:border-brand-500 outline-none font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Port</label>
                  <input
                    type="text"
                    value={sshPort}
                    onChange={e => setSshPort(e.target.value)}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 focus:bg-white focus:border-brand-500 outline-none font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Username</label>
                  <input
                    type="text"
                    value={sshUser}
                    onChange={e => setSshUser(e.target.value)}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 focus:bg-white focus:border-brand-500 outline-none font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-surface-700">Password</label>
                  <input
                    type="password"
                    value={sshPass}
                    onChange={e => setSshPass(e.target.value)}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 focus:bg-white focus:border-brand-500 outline-none font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Workspace & Environment */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-surface-200">
              <div className="border-b border-surface-200 pb-4 mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                    <Terminal size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-surface-900 font-display">Workspace & Toolchain Paths</h2>
                    <p className="text-xs text-surface-500">Remote directories, Conda environment, and custom CSV overrides</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={resetToolchainPaths}
                    className="text-xs bg-surface-100 hover:bg-surface-200 text-surface-700 px-3 py-1.5 rounded-lg font-semibold transition-colors border border-surface-200"
                    title="Reset workspace, Conda, and PSA paths without clearing SSH credentials"
                  >
                    Reset Toolchain Paths
                  </button>
                  <button
                    type="button"
                    onClick={resetCustomReferenceCsvs}
                    className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg font-semibold transition-colors border border-amber-200"
                    title="Delete custom uploaded TAP/TNP CSVs and restore built-in reference datasets"
                  >
                    Restore Default Reference CSVs
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-surface-700 flex items-center gap-1.5">
                    Remote Base Path
                    <InfoTooltip
                      title="Remote Base Path (远程集群工作根目录)"
                      description="远程 Linux 服务器上用于存放项目批次文件夹、上传的原始序列/结构文件、ImmuneBuilder 预测生成的 PDB 模型以及最终 TAP/TNP 剖析结果 CSV 报表的根目录。"
                      method="每次在 Pipeline 提交任务时，系统会自动在该路径下创建以 Project ID 命名的子文件夹（如 <RemoteBasePath>/jobs/proj_a1b2c3/），并在其中完成全流程计算。"
                      example="例如：`/share/users/zengxin/workspace/TAP_TNP`。若提交批次 ID 为 `proj_8f9k2m`，则结果保存在 `/share/users/zengxin/workspace/TAP_TNP/jobs/proj_8f9k2m/result/`。"
                    />
                  </label>
                  <input
                    type="text"
                    value={remoteBasePath}
                    onChange={e => setRemoteBasePath(e.target.value)}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 focus:bg-white focus:border-brand-500 outline-none font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-surface-700 flex items-center gap-1.5">
                    Conda Profile Script
                    <InfoTooltip
                      title="Conda Profile Script (Conda 初始化脚本路径)"
                      description="远程服务器上的 `conda.sh` 初始化脚本绝对路径。由于非交互式 SSH Shell 默认不加载 `~/.bashrc`，必须先通过 `source conda.sh` 才能激活目标 Conda 虚拟环境。"
                      formula="source <CondaProfile> && conda activate <ImmuneBuilderEnv>"
                      example="常见路径示例：\n• Miniforge3: `/share/software/miniforge3/etc/profile.d/conda.sh`\n• Miniconda3: `/home/user/miniconda3/etc/profile.d/conda.sh`\n• Anaconda3: `/opt/anaconda3/etc/profile.d/conda.sh`"
                    />
                  </label>
                  <input
                    type="text"
                    value={condaProfile}
                    onChange={e => setCondaProfile(e.target.value)}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 focus:bg-white focus:border-brand-500 outline-none font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-surface-700 flex items-center gap-1.5">
                    <Cpu size={13} className="text-surface-400" />
                    ImmuneBuilder Conda Env
                    <InfoTooltip
                      title="ImmuneBuilder Conda Environment (深度学习与编号环境名)"
                      description="远程集群中安装了 ImmuneBuilder（ABodyBuilder2 / NanoBodyBuilder2）、ANARCI（IMGT 编号工具）、Biopython 与 PyTorch 的 Conda 虚拟环境名称。"
                      method="系统在执行远程任务时会自动运行 `conda activate <EnvName>`，随后调用环境内的 Python 解释器执行结构建模与 TAP/TNP 批处理脚本。"
                      example="例如：`immunebuilder` 或 `tap_env`。可通过在服务器上运行 `conda env list` 查看环境名称。"
                    />
                  </label>
                  <input
                    type="text"
                    value={ibEnv}
                    onChange={e => setIbEnv(e.target.value)}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 focus:bg-white focus:border-brand-500 outline-none font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-surface-700 flex items-center gap-1.5">
                    <Terminal size={13} className="text-surface-400" />
                    PSA Binary Path
                    <InfoTooltip
                      title="Joy PSA Binary Path (溶剂可及表面积计算程序路径)"
                      description="Joy 软件包中 `psa`（Protein Solvent Accessibility）可执行文件的绝对路径，基于 Lee & Richards 滚动水球法（探针半径 1.4 Å）精确计算 PDB 结构中每个氨基酸残基的侧链相对溶剂可及表面积（% RSA）。"
                      method="TAP/TNP 脚本调用该二进制程序生成 `.psa` 文件，并读取第 61:66 列 `all S-chain` 百分比：当反应发生残基自身的侧链 RSA ≥ 7.5% 时判定为表面暴露（Exposed, `Exp`），否则为内部包埋（`Buried`）。"
                      example="例如：`/share/users/zengxin/data/AI_tools/TNP/bin/psa`。"
                    />
                  </label>
                  <input
                    type="text"
                    value={psaBin}
                    onChange={e => setPsaBin(e.target.value)}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 focus:bg-white focus:border-brand-500 outline-none font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-surface-700 flex items-center gap-1.5">
                    <FileText size={13} className="text-surface-400" />
                    Custom TAP Reference CSV
                    <InfoTooltip
                      title="Custom TAP Reference CSV (自定义单抗参考库覆盖)"
                      description="可选上传自定义的传统单抗（VH+VL）参考库 CSV 文件以覆盖系统内置的 `Analysis_Results_TAP.csv`（1,121 条 TheraSAbDab 临床单抗）。"
                      method="上传后，Guidelines 页面与 Results 结果表将立即基于您上传的 CSV 重新计算 5 级分位数阈值与 4-Tier PTM 热点频率。若需恢复内置标准库，点击右上角 `Restore Default Reference CSVs` 即可。"
                      example="支持包含标准 52 列 Schema（含 `Genetics`、`VHVL_*`、`VH_*`、`VL_*`）的 CSV 文件。"
                    />
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={e => e.target.files && uploadCustomReference('tap', e.target.files[0])}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 text-xs file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-surface-700 flex items-center gap-1.5">
                    <FileText size={13} className="text-surface-400" />
                    Custom TNP Reference CSV
                    <InfoTooltip
                      title="Custom TNP Reference CSV (自定义纳米抗体参考库覆盖)"
                      description="可选上传自定义的单域纳米抗体（VHH）参考库 CSV 文件以覆盖系统内置的 `Analysis_Results_TNP.csv`（39 条临床纳米抗体）。"
                      method="上传后自动重算 VHH 的 L、L3、C、PSH、PPC、PNC 及 1D 理化与 PTM 分布基线。"
                      example="支持包含标准 30 列 Schema（含 `VHH_*` 序列与 PTM 位点列）的 CSV 文件。"
                    />
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={e => e.target.files && uploadCustomReference('tnp', e.target.files[0])}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 text-xs file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Pure 3D Reference Library Re-Profiling */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-surface-200">
              <div className="border-b border-surface-200 pb-4 mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                    <Database size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-surface-900 font-display flex items-center gap-1.5">
                      Pure 3D Reference Library Re-Profiling (ANARCI + 3D DSSP + PSA)
                      <InfoTooltip
                        title="Pure 3D Reference Library Re-Profiling (纯 3D 结构参考库重剖析引擎)"
                        description="直接调用远程集群上的 `TAP_2024_Batch.py` 或 `TNP_2025_Batch.py`，对远程 3D PDB 目录中的所有参考库晶体/预测结构执行 100% 纯 3D 结构驱动剖析（绝无无结构序列回退）。"
                        method="脚本依次对每个 3D 结构执行：(1) `ANARCI --scheme imgt` 标定 `1–128` 区域坐标；(2) 基于 3D `N, CA, C, O` 坐标的 Kabsch-Sander (DSSP) 主链氢键能量方程（E < -0.5 kcal/mol）区分 `[CDR-Loop]` vs `[CDR-Strand]` 及 `[FR-Loop]` vs `[FR-Strand]`；(3) 调用 `Joy PSA` 计算反应残基侧链 RSA（≥ 7.5% 为 `Exp`），并通过 `--ref_csv` 保留临床阶段与 Genetics 元数据。"
                        example="您既可以在下方指定远程 PDB 目录后通过 SSH 一键重算并同步回本系统，也可以点击右侧按钮下载 `TAP_2024_Batch.py`、`TNP_2025_Batch.py` 及内置参考库 CSV。"
                      />
                    </h2>
                    <p className="text-xs text-surface-500">
                      Re-profile reference 3D PDB directories or download core batch scripts & reference CSVs
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="/api/reference/download/tap_script"
                    download="TAP_2024_Batch.py"
                    className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Download size={13} /> TAP_2024_Batch.py
                  </a>
                  <a
                    href="/api/reference/download/tnp_script"
                    download="TNP_2025_Batch.py"
                    className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Download size={13} /> TNP_2025_Batch.py
                  </a>
                  <a
                    href="/api/reference/download/tap"
                    download="Analysis_Results_TAP.csv"
                    className="text-xs bg-surface-100 hover:bg-surface-200 text-surface-700 border border-surface-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Download size={13} /> TAP CSV
                  </a>
                  <a
                    href="/api/reference/download/tnp"
                    download="Analysis_Results_TNP.csv"
                    className="text-xs bg-surface-100 hover:bg-surface-200 text-surface-700 border border-surface-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Download size={13} /> TNP CSV
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-surface-700 flex items-center gap-1">
                    Remote TAP 3D PDB Directory
                    <InfoTooltip
                      title="Remote TAP 3D PDB Directory (远程单抗 3D 结构目录)"
                      description="SSH 集群上存放 TheraSAbDab 临床单抗 3D `.pdb` / `.cif` 结构文件的文件夹路径。"
                      method="`TAP_2024_Batch.py` 会遍历该目录下的全部 3D 结构文件，执行 ANARCI IMGT 编号、3D DSSP 主链氢键二级结构计算、Joy PSA 侧链暴露度计算与 3D 半胱氨酸 Sγ–Sγ 二硫键配对检测（≤ 3.0 Å）。"
                      example="例如：`/share/users/zengxin/data/TheraSAbDab_PDBs`。"
                    />
                  </label>
                  <input
                    type="text"
                    value={remoteTapPdbDir}
                    onChange={e => setRemoteTapPdbDir(e.target.value)}
                    placeholder="e.g. /share/data/TheraSAbDab_PDBs"
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-xs font-mono focus:bg-white focus:border-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-surface-700 flex items-center gap-1">
                    Remote TNP 3D PDB Directory
                    <InfoTooltip
                      title="Remote TNP 3D PDB Directory (远程纳米抗体 3D 结构目录)"
                      description="SSH 集群上存放临床 VHH 纳米抗体 3D `.pdb` / `.cif` 结构文件的文件夹路径。"
                      method="`TNP_2025_Batch.py` 会遍历该目录下的全部 3D 结构文件，执行基于真实 3D 结构的 ANARCI + 3D DSSP + Joy PSA 全套剖析。"
                      example="例如：`/share/users/zengxin/data/TNP_VHH_PDBs`。"
                    />
                  </label>
                  <input
                    type="text"
                    value={remoteTnpPdbDir}
                    onChange={e => setRemoteTnpPdbDir(e.target.value)}
                    placeholder="e.g. /share/data/TNP_VHH_PDBs"
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-xs font-mono focus:bg-white focus:border-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-surface-700 flex items-center gap-1">
                    PTM Side-Chain RSA Cutoff (%)
                    <InfoTooltip
                      title="PTM Side-Chain RSA Cutoff (侧链相对溶剂可及性阈值)"
                      unit="%"
                      description="判定反应发生残基（N, D, M, W, C）侧链处于“表面暴露（Exposed）”还是“内部包埋（Buried）”的相对溶剂可及表面积（Relative Solvent Accessibility, RSA）百分比阈值。"
                      method="遵循牛津大学 OPIG TAP/TNP 文献标准，默认取 7.5%：当 Joy PSA 输出的第 61:66 列 `all S-chain` 相对百分比 ≥ 7.5% 时标注为 `Exp`，< 7.5% 时标注为 `Buried`。"
                      formula="RSA_sidechain(reactive residue) ≥ 7.5% → Exposed (Exp);   RSA_sidechain < 7.5% → Buried"
                      example="例如：CDR2 环上的 Asn54 侧链 RSA = 42.3%（≥ 7.5%）→ 标为 `Exp`；而骨架核心 Trp41 侧链 RSA = 0.8%（< 7.5%）→ 标为 `Buried`。"
                    />
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={ptmRsaCutoff}
                    onChange={e => setPtmRsaCutoff(e.target.value)}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-xs font-mono focus:bg-white focus:border-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => runRemoteCalibration('tap')}
                  disabled={calibratingType !== null}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Play size={13} />
                  {calibratingType === 'tap' ? 'Re-Profiling TAP 3D PDBs via SSH...' : 'Re-Profile TAP 3D PDBs via SSH'}
                </button>
                <button
                  onClick={() => runRemoteCalibration('tnp')}
                  disabled={calibratingType !== null}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Play size={13} />
                  {calibratingType === 'tnp' ? 'Re-Profiling TNP 3D PDBs via SSH...' : 'Re-Profile TNP 3D PDBs via SSH'}
                </button>
              </div>

              {calibrationLog && (
                <pre className="mt-4 bg-surface-900 text-surface-100 p-3.5 rounded-xl text-xs font-mono overflow-x-auto max-h-44 whitespace-pre-wrap">
                  {calibrationLog}
                </pre>
              )}
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-5 max-w-3xl mx-auto animate-in fade-in duration-200">
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-surface-200">
              <div className="flex items-center justify-between border-b border-surface-200 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-50 rounded-xl border border-brand-100">
                    <UploadCloud size={20} className="text-brand-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-surface-900 font-display">Submit Profiling Pipeline</h2>
                    <p className="text-xs text-surface-500">
                      Automated ImmuneBuilder 3D folding + TAP 2024 (mAb) / TNP 2025 (VHH) developability profiling
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-surface-700 uppercase tracking-wider flex items-center gap-1">
                      Project / Batch ID
                      <InfoTooltip
                        title="Project / Batch ID (项目与任务批次号)"
                        description="本次成药性评估任务的唯一标识符，用于在远程集群工作目录下创建独立任务文件夹并在 Results 页面追踪进度。"
                        example="例如：`proj_her2_opt01` 或系统自动生成的 `proj_k8m2x9`。"
                      />
                    </label>
                    <button
                      onClick={() => setProjectId(generateRandomId())}
                      className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold"
                    >
                      Randomize
                    </button>
                  </div>
                  <input
                    type="text"
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                    placeholder="e.g. proj_xyz123"
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3.5 py-2.5 text-xs text-surface-900 focus:bg-white focus:border-brand-500 outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-surface-700 uppercase tracking-wider flex items-center gap-1">
                    Input Mode
                    <InfoTooltip
                      title="Pipeline Input Mode (输入模式说明)"
                      description="支持从纯氨基酸序列（Sequence FASTA）或已有的三维结构文件（Structure PDB/CIF）启动自动化成药性剖析。"
                      method="• Sequence (FASTA)：系统自动识别每个抗体条目包含双链（VH+VL）还是单域（VHH），先调用 ABodyBuilder2 或 NanoBodyBuilder2 预测高精度 3D 结构，再运行 TAP 2024 / TNP 2025 剖析；\n• Structure (PDB/CIF)：跳过结构建模步骤，直接对上传的 3D 结构执行 ANARCI 编号、PSA 溶剂暴露度计算与成药性评估。"
                      example="FASTA 双链示例：同一个抗体包含 `>Ab1_VH` 与 `>Ab1_VL` 两条序列自动配对进入 TAP 2024 流程；若仅含单条重链 `>Nb1_VHH` 则自动进入 TNP 2025 纳米抗体流程。"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMode('fasta')}
                      className={`px-3.5 py-2.5 border rounded-xl text-xs font-semibold transition-all text-left flex items-center justify-between ${
                        mode === 'fasta'
                          ? 'bg-brand-50 border-brand-300 text-brand-900 ring-1 ring-brand-200'
                          : 'bg-surface-50 hover:bg-surface-100 border-surface-200 text-surface-600'
                      }`}
                    >
                      <span>Sequence (FASTA)</span>
                      <span className="w-2 h-2 rounded-full bg-current opacity-75" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('structure')}
                      className={`px-3.5 py-2.5 border rounded-xl text-xs font-semibold transition-all text-left flex items-center justify-between ${
                        mode === 'structure'
                          ? 'bg-brand-50 border-brand-300 text-brand-900 ring-1 ring-brand-200'
                          : 'bg-surface-50 hover:bg-surface-100 border-surface-200 text-surface-600'
                      }`}
                    >
                      <span>Structure (PDB/CIF)</span>
                      <span className="w-2 h-2 rounded-full bg-current opacity-75" />
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer relative group ${
                  isDragging
                    ? 'border-brand-500 bg-brand-50/60'
                    : 'border-surface-200 bg-surface-50/70 hover:bg-surface-100/70 hover:border-brand-300'
                }`}
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) {
                    setFiles(Array.from(e.dataTransfer.files));
                  }
                }}
              >
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white border border-surface-200 shadow-2xs flex items-center justify-center text-surface-500 group-hover:text-brand-600 transition-colors">
                  <UploadCloud size={24} />
                </div>
                <p className="font-bold text-sm text-surface-800 font-display">
                  {isDragging ? 'Drop files here' : 'Click or drag files to upload'}
                </p>
                <p className="text-xs text-surface-500 mt-1">
                  Supports <span className="font-mono">.fasta</span>, <span className="font-mono">.pdb</span>,{' '}
                  <span className="font-mono">.cif</span> (batch multi-file upload supported)
                </p>
              </div>

              {files.length > 0 && (
                <div className="mt-5 bg-surface-50 rounded-xl p-4 border border-surface-200">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-bold text-surface-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <List size={14} className="text-brand-600" />
                      Selected Files ({files.length})
                    </p>
                    <button
                      onClick={() => setFiles([])}
                      className="text-xs text-surface-500 hover:text-rose-600 font-medium"
                    >
                      Clear all
                    </button>
                  </div>
                  <ul className="text-xs text-surface-700 space-y-1.5 max-h-40 overflow-y-auto pr-1 font-mono">
                    {files.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2.5 bg-white px-3 py-2 rounded-lg border border-surface-200/80"
                      >
                        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end mt-6 pt-4 border-t border-surface-100">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || files.length === 0}
                  className="bg-surface-900 hover:bg-surface-800 disabled:bg-surface-200 disabled:text-surface-400 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-xs transition-all text-xs"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse">Submitting to Cluster...</span>
                  ) : (
                    <>
                      <Play size={15} /> Run Profiling Pipeline
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && <Tasks sshConnected={sshConnected} remoteBasePath={remoteBasePath} />}

        {activeTab === 'guidelines' && <Guidelines sshConnected={sshConnected} refreshKey={refreshKey} />}

        {activeTab === 'docs' && <Docs />}
      </main>
    </div>
  );
}
