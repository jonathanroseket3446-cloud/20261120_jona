import React, { useState } from 'react';
import {
  BookOpen,
  Code2,
  Cpu,
  Database,
  Layers,
  ShieldAlert,
  Sparkles,
  Terminal,
  Compass,
  CheckCircle2,
  FlaskConical,
  FileSpreadsheet,
  Sliders
} from 'lucide-react';

type DocLang = 'zh' | 'en';
type DocSectionId =
  | 'quickstart'
  | 'pipeline3d'
  | 'tier5'
  | 'algo3d'
  | 'algo1d'
  | 'ptm'
  | 'schema'
  | 'architecture'
  | 'bestpractices';

export default function Docs() {
  const [lang, setLang] = useState<DocLang>('zh');
  const [activeSection, setActiveSection] = useState<DocSectionId>('quickstart');

  const sections: { id: DocSectionId; icon: React.ReactNode; titleZh: string; titleEn: string; badge?: string }[] = [
    { id: 'quickstart', icon: <Compass className="w-4 h-4" />, titleZh: '1. 快速入门与标准工作流', titleEn: '1. Quick Start & Workflow' },
    { id: 'pipeline3d', icon: <Sliders className="w-4 h-4" />, titleZh: '2. 3D IMGT · DSSP · PSA 底层引擎', titleEn: '2. 3D IMGT · DSSP · PSA Engine', badge: 'CORE' },
    { id: 'tier5', icon: <Sparkles className="w-4 h-4" />, titleZh: '3. 5 级色阶与 4 维分群体系', titleEn: '3. 5-Tier Color & 4D Cohort' },
    { id: 'algo3d', icon: <Cpu className="w-4 h-4" />, titleZh: '4. 01 板块：3D 表面斑块与构象算法', titleEn: '4. 01: 3D Surface & CDR Math' },
    { id: 'algo1d', icon: <FlaskConical className="w-4 h-4" />, titleZh: '5. 02 板块：双链耦合生物物理算法', titleEn: '5. 02: Coupled Biophysical Math' },
    { id: 'ptm', icon: <ShieldAlert className="w-4 h-4" />, titleZh: '6. 03 板块：金标准 4 级 PTM 与环区开关', titleEn: '6. 03: Gold-Standard 4-Tier PTM', badge: 'v3.5' },
    { id: 'schema', icon: <FileSpreadsheet className="w-4 h-4" />, titleZh: '7. 全量 52 / 30 列数据字典与语法', titleEn: '7. 52 / 30-Column Canonical Schema' },
    { id: 'architecture', icon: <Database className="w-4 h-4" />, titleZh: '8. 系统架构与远程 HPC 批处理', titleEn: '8. Architecture & Remote HPC' },
    { id: 'bestpractices', icon: <CheckCircle2 className="w-4 h-4" />, titleZh: '9. 抗体工程成药性排雷指南', titleEn: '9. Engineering Best Practices' },
  ];

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Top Banner */}
      <div className="bg-stone-900 text-white px-8 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-800">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight">
                {lang === 'zh' ? 'AbDev Studio 系统文档与算法白皮书' : 'AbDev Studio System Documentation & Algorithm Whitepaper'}
              </h2>
              <span className="px-2.5 py-0.5 text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md">
                v3.5 Gold-Standard
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-1">
              {lang === 'zh'
                ? '涵盖 OPIG TAP (2024) 传统单抗 (N=1,121) 与 TNP (2025) 纳米抗体 (N=39) 纯 3D 结构驱动流水线、Kabsch-Sander DSSP 环区判定与 4 级 PTM 工业金标准'
                : 'Comprehensive guide for OPIG TAP (2024) mAb (N=1,121) & TNP (2025) Nanobody (N=39) pure 3D structure-driven pipeline, Kabsch-Sander DSSP loop assignment, and 4-Tier PTM Gold Standard'}
            </p>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="inline-flex items-center bg-stone-800 p-1 rounded-xl border border-stone-700 self-start md:self-auto">
          <button
            onClick={() => setLang('zh')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              lang === 'zh' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            中文文档 (ZH)
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              lang === 'en' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            English (EN)
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[760px]">
        {/* Left Navigation Sidebar */}
        <aside className="lg:col-span-3 bg-stone-50/80 border-r border-stone-200 p-4 space-y-1.5">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-stone-400">
            {lang === 'zh' ? '文档章节目录' : 'Documentation Chapters'}
          </div>
          {sections.map((sec) => {
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold transition-all ${
                  active
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <span className={active ? 'text-emerald-400' : 'text-stone-400'}>{sec.icon}</span>
                  <span className="truncate">{lang === 'zh' ? sec.titleZh : sec.titleEn}</span>
                </span>
                {sec.badge && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 text-[9px] font-mono rounded ${
                      active ? 'bg-emerald-500/30 text-emerald-300' : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {sec.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Quick Reference Card in Sidebar */}
          <div className="mt-6 p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-2">
            <div className="font-bold text-emerald-950 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-700" />
              <span>{lang === 'zh' ? '算法与悬停提示全覆盖' : '100% Tooltip & Formula Coverage'}</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              {lang === 'zh'
                ? '工作台中所有表头、指标卡片与分布图均内置了「定义 · 方法 · 公式 · 实例」四段式悬停提示（InfoTooltip），其底层实现与本文档 100% 严丝合缝。'
                : 'Every table header, metric card, and distribution chart in the workspace features a 4-part InfoTooltip (Summary, Method, Formula, Example) 100% synchronized with this specification.'}
            </p>
          </div>
        </aside>

        {/* Right Article Area */}
        <div className="lg:col-span-9 p-6 md:p-10 overflow-y-auto max-h-[880px]">
          {lang === 'zh' ? (
            <ZhDocContent activeSection={activeSection} />
          ) : (
            <EnDocContent activeSection={activeSection} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * CHINESE DOCUMENTATION CONTENT (v3.5 Comprehensive Edition)
 * ============================================================================ */
function ZhDocContent({ activeSection }: { activeSection: DocSectionId }) {
  switch (activeSection) {
    case 'quickstart':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 01 · Quick Start</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">快速入门与标准端到端工作流</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              <strong>AbDev Studio (Antibody &amp; Nanobody Developability Workbench)</strong> 是面向治疗性单克隆抗体（mAb Fv，重链 VH + 轻链 VL）与单域纳米抗体（Nanobody / VHH）的<strong>纯 3D 结构驱动型成药性评估平台</strong>。系统将待测抗体的 3D 结构与物理化学属性，投射至牛津大学蛋白信息学组（OPIG）<strong>TAP (2024, N = 1,121)</strong> 与 <strong>TNP (2025, N = 39)</strong> 临床参考分布中，提供定量的分位数评级与精确到单个残基三维构象的 PTM 排雷。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="text-xs font-mono font-bold text-emerald-700">STEP 1 · 选择分子模态与导入数据</div>
              <h4 className="font-bold text-stone-900 text-sm">双模态工作台（TAP 2024 vs. TNP 2025）</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                在顶部切换 <strong>TAP (2024) · 传统单抗 (VH+VL)</strong> 或 <strong>TNP (2025) · 纳米抗体 (VHH)</strong>：
                <br />• <strong>本地 3D 结构上传</strong>：支持直接拖入多个 <code>.pdb</code> / <code>.cif</code> 三维结构文件（ImmuneBuilder / ABodyBuilder2 / NanoBodyBuilder2 / AlphaFold3 或晶体结构）。
                <br />• <strong>远程 HPC 集群执行</strong>：通过 SSH 连接配备 <code>ANARCI</code> 与 <code>Joy PSA</code> 的 Linux 服务器，对远程目录中的大批量 PDB 结构并行计算。
                <br />• <strong>分析结果 CSV 导入</strong>：直接上传 <code>Analysis_Results_TAP.csv</code>（52 列）或 <code>Analysis_Results_TNP.csv</code>（30 列）进行离线可视化与报告导出。
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="text-xs font-mono font-bold text-emerald-700">STEP 2 · 4 维临床参考队列过滤</div>
              <h4 className="font-bold text-stone-900 text-sm">动态匹配高度同源的临床参考子集</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                在 <strong>Results &amp; Compare</strong> 顶部过滤栏，可按 4 个维度实时收敛临床参考背景库：
                <br />1. <strong>临床阶段 (Stage)</strong>：Approved（已上市）、Phase I / II / III、Preregistration；
                <br />2. <strong>重链/纳米抗体胚系家族 (Heavy / VHH Subtype)</strong>：如 <code>IGHV1</code>、<code>IGHV3</code>、<code>IGHV4</code>；
                <br />3. <strong>轻链亚型 (Light Subtype)</strong>：<code>KAPPA (κ)</code> vs <code>LAMBDA (λ)</code>；
                <br />4. <strong>抗体形式 (Format)</strong>：Whole mAb、Bispecific、Fab、scFv、VHH。
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="text-xs font-mono font-bold text-emerald-700">STEP 3 · 三大板块全景审查与 PTM 环区切换</div>
              <h4 className="font-bold text-stone-900 text-sm">01 3D 表面 · 02 理化性质 · 03 PTM 热点</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                • <strong>01. 3D Surface &amp; CDR</strong>：核查 CDR 长度、表面疏水斑块（PSH）、正/负电荷斑块（PPC/PNC）、Fv 电荷对称性（SFvCSP）或 VHH CDR3 紧凑度（C）与 FR2 四联体；
                <br />• <strong>02. Physicochemical</strong>：审查双链耦合等电点（<code>VHVL_pI</code>）、生理净电荷、GRAVY 与 Guruprasad 不稳定指数；
                <br />• <strong>03. PTM &amp; IMGT Hotspots</strong>：默认启用与 01 板块 100% 严丝合缝的 <strong>CDR-Loop Only (Default)</strong> 模式，亦可一键开启 <strong>+ FR-Loop (Extended)</strong> 全面排查骨架暴露环区（如去免疫化/人源化引入的 FR 环区修饰位点）。
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="text-xs font-mono font-bold text-emerald-700">STEP 4 · 交互式分布对比与批量导出</div>
              <h4 className="font-bold text-stone-900 text-sm">直方图叠加定位 &amp; Excel / CSV / HTML 报告</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                • 点击表格任意行可展开该抗体的<strong>全指标临床分布直方图</strong>，绿色竖线标示当前候选分子在临床队列中的精确位置及 P5/P25/P75/P95 边界；
                <br />• 支持勾选多个候选分子（Max 10）进行并排分布叠加对比；
                <br />• 右上角一键导出带 5 级/4 级颜色编码的 <strong>Excel (.xlsx)</strong>、原始 <strong>CSV</strong> 或独立可交互的 <strong>HTML 评估报告</strong>。
              </p>
            </div>
          </div>
        </div>
      );

    case 'pipeline3d':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 02 · Pure 3D Structural Engine</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">3D IMGT 编号 · Kabsch-Sander DSSP 二级结构 · Joy PSA 暴露度引擎</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              本系统的每个待测分子均具备真实或高精建模的 3D 结构（<code>.pdb</code> / <code>.cif</code>），<strong>不存在任何退化回纯序列奇偶性或固定侧翼偏移的回退策略（Zero Sequence-Only Fallbacks）</strong>。底层 Python 批处理引擎（<code>TAP_2024_Batch.py</code> 与 <code>TNP_2025_Batch.py</code>）在单次运行中协同执行以下三大结构生物学解析：
            </p>
          </div>

          {/* 2.1 ANARCI IMGT */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-stone-900 text-white text-xs font-mono flex items-center justify-center">1</span>
              <span>ANARCI IMGT 编号与序列-结构精确映射（含插入码处理）</span>
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              脚本首先从 PDB 原子坐标提取各链的氨基酸序列（调用 <code>Bio.SeqUtils.seq1(resname, custom_map=&#123;&quot;UNK&quot;: &quot;X&quot;&#125;)</code>），并调用 <code>ANARCI --scheme imgt</code> 执行标准 IMGT 编号：
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-white rounded-xl border border-stone-200">
                <div className="font-bold text-stone-900 mb-1">IMGT 高变区 (CDR) 与骨架区 (FR) 边界</div>
                <ul className="space-y-1 text-stone-600 font-mono text-[11px]">
                  <li>• FR1  : IMGT 1 – 26   (含保守二硫键 Cys23)</li>
                  <li>• CDR1 : IMGT 27 – 38  (锚点 Trp41 紧随其后)</li>
                  <li>• FR2  : IMGT 39 – 55  (含 VHH 四联体 42, 49, 50, 52)</li>
                  <li>• CDR2 : IMGT 56 – 65</li>
                  <li>• FR3  : IMGT 66 – 104 (含保守二硫键 Cys104)</li>
                  <li>• CDR3 : IMGT 105 – 117 (锚点 Trp118 / Phe118 紧随其后)</li>
                  <li>• FR4  : IMGT 118 – 128</li>
                </ul>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-stone-200">
                <div className="font-bold text-stone-900 mb-1">CDR3 对称插入码 (Insertion Codes) 兼容</div>
                <p className="text-stone-600 leading-relaxed text-[11px]">
                  当 CDR3 长度超过 13 AA 时，IMGT 采用在顶部对称插入字母的编号规则（如 <code>111A, 111B ... 112B, 112A</code> 或 <code>111.1, 112.1</code>）。
                  <br />系统不仅完整保留完整编号字符串 <code>imgt_full</code>（如 <code>IMGT111A</code>）用于位点标签输出，同时提取整型主编号 <code>imgt_num = 111</code> 用于区间归属判定，确保所有带插入码的超长 CDR 环残基 100% 被纳入分析。
                </p>
              </div>
            </div>
          </div>

          {/* 2.2 3D Kabsch-Sander DSSP */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-stone-900 text-white text-xs font-mono flex items-center justify-center">2</span>
              <span>3D Kabsch-Sander 主链氢键静电模型：精准区分 CDR/FR 中的 Loop 环与 β-Strand 折叠股</span>
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              <strong>核心科学问题</strong>：IMGT 编号区间（27–38, 56–65, 105–117）标定的是高变区（CDR），但 <strong>CDR 区域并不全都是柔性的无规卷曲环（Loop）</strong>！在免疫球蛋白 β-三明治拓扑中，CDR 的首尾两端（如 IMGT 27–28, 37–38, 56–57, 64–65, 105–106, 116–117）往往是反平行 β-折叠股（β-strands B, C, C&apos;, C&apos;&apos;, F, G）向顶部延伸的刚性茎区（Stem），其主链通过紧密的跨股氢键锁定；反之，骨架区（FR1/FR2/FR3）中也包含多段连接相邻 β-股的柔性转角环（如 FR1 B-C 环、FR2 C&apos;-C&apos;&apos; 环、FR3 D-E &quot;CDR4&quot; 环）。
            </p>
            <div className="p-4 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs space-y-2 overflow-x-auto">
              <div className="text-emerald-400 font-bold"># Kabsch &amp; Sander (1983) Biopolymers 22:2577-2637 · 主链氢键静电能公式</div>
              <div>E(C=O_i, N-H_j) = 0.42 × 0.20 × 332.0 × (1/r_ON + 1/r_CH − 1/r_OH − 1/r_CN)   [kcal/mol]</div>
              <div className="text-stone-400">• 氢键重构：对 i &gt; 0 且非脯氨酸 (Pro) 的残基，由前驱肽平面向量精准重构酰胺氢坐标 H = N + 1.01Å × norm(norm(N − C_&#123;i-1&#125;) + norm(N − CA))</div>
              <div className="text-stone-400">• 氢键判据：当 |i − j| ≥ 2 且 E &lt; −0.5 kcal/mol 时，判定主链 C=O(i) 与 N-H(j) 形成氢键</div>
              <div className="text-stone-400">• 反平行与平行 β-桥 (β-bridge)：满足 [hb(i,j) &amp; hb(j,i)] 或 [hb(i-1,j+1) &amp; hb(j-1,i+1)]（反平行），或 [hb(i-1,j) &amp; hb(j,i+1)]（平行）</div>
              <div className="text-emerald-300">• β-折叠股 (Strand) 赋值：连续 ≥ 2 个形成跨股 β-桥（|i − j| ≥ 3）的残基（以及被两侧 β-桥夹持的单残基）赋值为 Strand；其余所有残基赋值为柔性 Loop 环区</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs pt-1">
              <div className="p-3 bg-white rounded-xl border border-emerald-200">
                <div className="font-mono font-bold text-emerald-800">[CDR-Loop]</div>
                <p className="text-[11px] text-stone-600 mt-1">位于 IMGT CDR 区间，且 3D DSSP 判定为真柔性环顶（高 PTM 构象异构化敏感区）。</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-stone-200">
                <div className="font-mono font-bold text-stone-700">[CDR-Strand]</div>
                <p className="text-[11px] text-stone-600 mt-1">位于 IMGT CDR 根部锚点，但 3D 构象属于刚性 β-折叠股茎区（受氢键刚性保护）。</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-amber-200">
                <div className="font-mono font-bold text-amber-800">[FR-Loop]</div>
                <p className="text-[11px] text-stone-600 mt-1">位于 IMGT FR 骨架区，但 3D DSSP 判定为连接两条 β-股的表面柔性转角环。</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-stone-200">
                <div className="font-mono font-bold text-stone-700">[FR-Strand]</div>
                <p className="text-[11px] text-stone-600 mt-1">位于 IMGT FR 骨架区的核心免疫球蛋白 β-桶折叠股（高度刚性保护）。</p>
              </div>
            </div>
          </div>

          {/* 2.3 Joy PSA RSA */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-stone-900 text-white text-xs font-mono flex items-center justify-center">3</span>
              <span>Joy PSA 侧链相对溶剂可及表面积（Side-Chain RSA ≥ 7.5% 表面暴露阈值）</span>
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              系统调用经典的 <code>psa</code>（Joy 软件包中的 Lee &amp; Richards 溶剂可及表面积程序，探针半径 1.4 Å）解析 <code>.asa</code> 输出文件的每个残基<strong>侧链相对溶剂可及表面积（Relative Side-Chain Surface Accessibility, RSA%，对应 <code>.asa</code> 文件第 50–55 列）</strong>：
            </p>
            <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside">
              <li>
                <strong>双链复合结构整体计算（Whole Fv Complex Context）</strong>：在传统单抗 TAP 模式下，<code>psa</code> 在完整的 VH+VL 异源二聚体 PDB 上运行。因此，被 VH:VL 结合界面掩埋的残基（如 FR2 的 Val42、Leu50、Trp52 以及 CDR3 根部被对侧链遮挡的残基）其侧链 RSA 自然低于阈值，<strong>自动被判定为包埋态（<code>Buried</code>）</strong>。
              </li>
              <li>
                <strong>统一暴露阈值（RSA_side-chain ≥ 7.5%）</strong>：严格遵循 OPIG Raybould et al. (2019/2024) 标准，当且仅当侧链 RSA ≥ 7.5% 时，残基标记为 <code>Exp</code>（Exposed，表面暴露），同时驱动 <strong>01 板块的 3D 表面斑块积分</strong> 与 <strong>03 板块的 PTM 表面暴露判定</strong>。
              </li>
            </ul>
          </div>
        </div>
      );

    case 'tier5':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 03 · 5-Tier Quantitative Rating</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">5 级定量分位数色阶体系与双向极值预警</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              为什么不能对所有理化指标使用死板的“单侧固定阈值”？因为临床成功抗体的生物物理参数（如 CDR 长度、表面疏水斑块 PSH、等电点 pI、生理净电荷、不稳定指数等）普遍服从<strong>以生理最优稳态为中心的单峰分布</strong>——偏离临床人群分布的<strong>过高（&gt; P95）或过低（&lt; P5）双侧极端尾区</strong>均意味着潜在的结构或工艺风险。
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-900 text-white">
                  <th className="p-3.5 font-semibold">色阶等级 (Tier Badge)</th>
                  <th className="p-3.5 font-semibold">定量分位数区间 (Quantile Range)</th>
                  <th className="p-3.5 font-semibold">定量指标 (01 3D &amp; 02 理化) 含义</th>
                  <th className="p-3.5 font-semibold">定性风险 (03 PTM &amp; 热点) 含义</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                <tr>
                  <td className="p-3.5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-700 text-white">
                      D-GREEN (Optimal)
                    </span>
                  </td>
                  <td className="p-3.5 font-mono font-bold text-emerald-800">25% – 75% (IQR 核心 50%)</td>
                  <td className="p-3.5 text-stone-600">落入当前筛选临床参考队列的核心四分位距（IQR），与主流已上市/临床抗体高度一致。</td>
                  <td className="p-3.5 text-stone-600"><strong>Protected / None</strong>：未检出任何修饰模体，或模体位于刚性 β-折叠股（<code>[*-Strand]</code>）/ 内部包埋区（<code>[*,Buried]</code>，RSA &lt; 7.5%）。</td>
                </tr>
                <tr>
                  <td className="p-3.5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      L-GREEN (Normal)
                    </span>
                  </td>
                  <td className="p-3.5 font-mono font-bold text-emerald-700">5% – 25% 或 75% – 95%</td>
                  <td className="p-3.5 text-stone-600">处于临床常见波动范围内（涵盖中心 90% 临床分布的次优两翼），成药性风险可控。</td>
                  <td className="p-3.5 text-stone-600"><strong>Tier 4 Low Risk (低危慢速)</strong>：暴露环区内的其他 15 种慢速脱酰胺 <code>Nx</code>（含 <code>NP</code>）或 17 种慢速异构化/断裂 <code>Dx</code>（含 <code>DP</code>）。</td>
                </tr>
                <tr>
                  <td className="p-3.5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      AMBER (Warning)
                    </span>
                  </td>
                  <td className="p-3.5 font-mono font-bold text-amber-700">[Min, 5%) 或 (95%, Max]</td>
                  <td className="p-3.5 text-stone-600">落入临床参考库的<strong>极端 5% 双侧尾区</strong>（但在历史极值 Min–Max 边界内），建议重点复核。</td>
                  <td className="p-3.5 text-stone-600"><strong>Tier 3 Moderate Risk (中危高频)</strong>：暴露环区内的 <code>M, W</code>（氧化）、<code>NS, NT, NN, NH</code>（中危脱酰胺）及 <code>DS, DD</code>（中危异构化）。</td>
                </tr>
                <tr>
                  <td className="p-3.5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-600 text-white">
                      RED (Outlier / High)
                    </span>
                  </td>
                  <td className="p-3.5 font-mono font-bold text-rose-700">&lt; Min 或 &gt; Max (突破极值)</td>
                  <td className="p-3.5 text-stone-600"><strong>彻底突破</strong>所选临床参考库的历史最小值或最大值边界，存在显著物理化学异常。</td>
                  <td className="p-3.5 text-stone-600"><strong>Tier 1 Intolerable &amp; Tier 2 High Risk</strong>：游离半胱氨酸 <code>Free Cys</code>、可变区 N-糖基化 <code>N-X-S/T</code>，或暴露环区极高危 <code>NG</code> / <code>DG</code>。</td>
                </tr>
                <tr>
                  <td className="p-3.5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-stone-100 text-stone-600 border border-stone-300">
                      GRAY (Info)
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-stone-500">N/A (元数据 / 序列文本)</td>
                  <td className="p-3.5 text-stone-600" colSpan={2}>用于抗体名称、IMGT CDR 序列文本、VHH FR2 特征四联体氨基酸文本等非评判性基础信息列。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'algo3d':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 04 · 01. 3D Surface &amp; CDR Algorithms</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">01 板块：3D 表面斑块与 CDR 空间构象精确数学规范</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              本章节完整列出 <code>TAP_2024_Batch.py</code> 与 <code>TNP_2025_Batch.py</code> 中 01 板块所有 3D 指标的精确数学方程与底层实现细节（参考文献：Raybould et al., <em>PNAS</em> 2019; <em>NAR</em> 2024; <em>mAbs</em> 2025）。
            </p>
          </div>

          {/* 4.1 CDR Vicinity & Salt Bridge */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm">4.1 CDR 邻域定义（CDR Vicinity）、暴露判据与分子内盐桥中和</h4>
            <ul className="text-xs text-stone-600 space-y-2 leading-relaxed">
              <li>
                <strong>1. 表面暴露残基集合（E_surf）</strong>：由 Joy <code>psa</code> 测算的侧链相对溶剂可及表面积 RSA_side-chain(i) ≥ 7.5% 的残基组成。
              </li>
              <li>
                <strong>2. CDR 邻域集合（V_CDR）</strong>：首先以 IMGT CDR 及其根部锚点区间 <code>IMGT_CDR_ANCHORS = [25–40, 54–67, 103–119]</code> 作为种子区；任何表面暴露残基 k ∈ E_surf，若自身位于种子区间内，或者其任意非氢重原子与种子区任意残基的非氢重原子最小欧氏距离 ≤ 4.0 Å，则纳入 V_CDR。
              </li>
              <li>
                <strong>3. 分子内盐桥疏水重置（Salt-Bridge Neutralization to Gly）</strong>：对于任意酸性残基 a ∈ &#123;Asp, Glu&#125; 的侧链氧原子（<code>OD1, OD2, OE1, OE2</code>）与碱性残基 b ∈ &#123;Arg, Lys, His&#125; 的侧链氮原子（<code>NH1, NH2, NE, NZ, ND1, NE2</code>），若最小距离 d(O_a, N_b) &lt; 3.2 Å，则判定形成分子内盐桥，将两者的疏水标度重置为甘氨酸水平（H_a ← H_Gly = 1.4545, H_b ← H_Gly = 1.4545），而电荷权重 q 保持不变。
              </li>
              <li>
                <strong>4. 残基对最小重原子距离（r_ij）</strong>：在所有斑块积分中，两个残基 i, j 之间的空间距离 r_ij 严格定义为<strong>两残基所有非氢重原子坐标集合之间的最小成对欧氏距离</strong>：
                <span className="block font-mono bg-white p-2 rounded-lg border border-stone-200 mt-1 text-stone-800">
                  r_ij = min_&#123;a ∈ HeavyAtoms(i), b ∈ HeavyAtoms(j)&#125; || x_a − x_b ||₂   (作用截断阈值: 0 &lt; r_ij &lt; 7.5 Å)
                </span>
              </li>
            </ul>
          </div>

          {/* 4.2 TAP 2024 Metrics */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm">4.2 TAP (2024) 传统双链单抗 (VH+VL) 五大 3D 指标公式</h4>
            <div className="p-4 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs space-y-2.5 overflow-x-auto">
              <div><span className="text-emerald-400 font-bold">1. Total CDR Length (L_tot):</span>  L_tot = ∑_&#123;k=1..3&#125; len(CDRH_k) + ∑_&#123;k=1..3&#125; len(CDRL_k)   [IMGT 27–38, 56–65, 105–117]</div>
              <div><span className="text-emerald-400 font-bold">2. Patches of Surface Hydrophobicity (PSH):</span>  PSH = 2 × ∑_&#123;i &lt; j ∈ V_CDR, r_ij &lt; 7.5Å&#125; (H_i · H_j) / r_ij²</div>
              <div className="text-stone-400 pl-4">其中 H ∈ [1.0, 2.0] 为正向平移归一化 Kyte-Doolittle 疏水值（Arg=1.000, Gly=1.4545, Ile=2.000）</div>
              <div><span className="text-emerald-400 font-bold">3. Patches of Positive Charge (PPC):</span>  PPC = 2 × ∑_&#123;i &lt; j ∈ V_CDR, q_i&gt;0, q_j&gt;0, r_ij &lt; 7.5Å&#125; (q_i · q_j) / r_ij²   [q_R = q_K = +1.0, q_H = +0.1]</div>
              <div><span className="text-emerald-400 font-bold">4. Patches of Negative Charge (PNC):</span>  PNC = 2 × ∑_&#123;i &lt; j ∈ V_CDR, q_i&lt;0, q_j&lt;0, r_ij &lt; 7.5Å&#125; (|q_i| · |q_j|) / r_ij²   [|q_D| = |q_E| = 1.0]</div>
              <div><span className="text-emerald-400 font-bold">5. Structural Fv Charge Symmetry Parameter (SFvCSP):</span>  SFvCSP = (∑_&#123;i ∈ Exposed(VH)&#125; q_i) × (∑_&#123;j ∈ Exposed(VL)&#125; q_j)   [单位: e²]</div>
            </div>
          </div>

          {/* 4.3 TNP 2025 Metrics */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm">4.3 TNP (2025) 纳米抗体 (VHH) 七大 3D 与骨架特征指标公式</h4>
            <div className="p-4 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs space-y-2.5 overflow-x-auto">
              <div><span className="text-emerald-400 font-bold">1. VHH Total CDR Length (L):</span>  L = len(CDR1: 27–38) + len(CDR2: 56–65) + len(CDR3: 105–117)</div>
              <div><span className="text-emerald-400 font-bold">2. VHH CDR3 Length (L3):</span>  L3 = len(CDR3: IMGT 105–117, 含 111A/112A 等所有插入位点)</div>
              <div><span className="text-emerald-400 font-bold">3. CDR3 Compactness (C):</span>  C = L3 / ρ,   其中 ρ = || Centroid_bb(IMGT 105–117) − Centroid_bb(IMGT 102, 103, 118, 119) ||₂   [单位: AA / Å]</div>
              <div className="text-stone-400 pl-4">注：Centroid_bb 为上述区间残基主链原子 (N, CA, C) 三维坐标的算术几何质心；C 值越大代表 CDR3 越紧密回折贴合 FR2</div>
              <div><span className="text-emerald-400 font-bold">4. VHH PSH / PPC / PNC:</span>  在单域 VHH 的 CDR 邻域 V_CDR (含无轻链遮挡而暴露的 FR2 4.0Å 邻近残基) 上按与 TAP 相同的距离平方反比公式积分</div>
              <div><span className="text-emerald-400 font-bold">5. FR2 Hallmark Tetrad:</span>  提取 IMGT 第 42, 49, 50, 52 四位氨基酸组成四联体（如亲水驼源 FERF / FERG / YQRL vs 疏水人源 VH 样 VGLW）</div>
            </div>
          </div>
        </div>
      );

    case 'algo1d':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 05 · 02. Physicochemical Algorithms</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">02 板块：双链耦合与单链生物物理算法（Biopython ProtParam 标准）</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              在传统单抗中，Fv 是由一条重链可变区（VH）和一条轻链可变区（VL）通过非共价作用组装而成的<strong>异源二聚体（Heterodimer）</strong>。系统在 Python 批处理端与 TypeScript 前端引擎中采用完全一致的物理化学守恒律与 <strong>Biopython <code>Bio.SeqUtils.ProtParam</code> (Bjellqvist et al.) 标准 pKa 参数表</strong>，分别计算双链整体（<code>VHVL_</code>）与单链（<code>VH_</code>、<code>VL_</code>、<code>VHH_</code>）指标。
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-900 text-white">
                  <th className="p-3.5 font-semibold">理化指标</th>
                  <th className="p-3.5 font-semibold">单链/单域公式 (VH / VL / VHH)</th>
                  <th className="p-3.5 font-semibold">双链 Fv 联合公式 (VH+VL)</th>
                  <th className="p-3.5 font-semibold">物理化学守恒依据与防呆设计</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                <tr>
                  <td className="p-3.5 font-bold text-stone-900">序列长度 (Len)</td>
                  <td className="p-3.5 font-mono">L_chain</td>
                  <td className="p-3.5 font-mono">L_VH + L_VL</td>
                  <td className="p-3.5 text-stone-600">精确统计 PDB 坐标或输入序列中的有效氨基酸残基总数。</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-stone-900">分子量 (MW, Da)</td>
                  <td className="p-3.5 font-mono">∑ m(aa_i) − (L−1)×18.0153</td>
                  <td className="p-3.5 font-mono">MW_VH + MW_VL</td>
                  <td className="p-3.5 text-stone-600"><strong>严禁直接拼接字符串求单链 MW</strong>：VH 与 VL 之间无肽键缩合，保留 2 套完整游离末端，差值为 18.0153 Da。</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-stone-900">等电点 (pI, pH)</td>
                  <td className="p-3.5 font-mono">Solve Z_chain(pH) = 0</td>
                  <td className="p-3.5 font-mono">Solve Z_VH(pH) + Z_VL(pH) = 0</td>
                  <td className="p-3.5 text-stone-600"><strong>双链耦合滴定求根</strong>：保留 2 个游离 N 端与 2 个游离 C 端，在 pH ∈ [0, 14] 执行 60 步二分法求根（绝不可取两链 pI 算术平均）。</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-stone-900">pH 7.4 净电荷 (e)</td>
                  <td className="p-3.5 font-mono">Z_chain(7.40)</td>
                  <td className="p-3.5 font-mono">Z_VH(7.40) + Z_VL(7.40)</td>
                  <td className="p-3.5 text-stone-600">在生理血液 pH = 7.40 下，复合物总净电荷严格等于各独立亚基净电荷的代数和。</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-stone-900">亲疏水指数 (GRAVY)</td>
                  <td className="p-3.5 font-mono">(1/L) ∑ KD(aa_i)</td>
                  <td className="p-3.5 font-mono">(L_VH·G_VH + L_VL·G_VL)/(L_VH+L_VL)</td>
                  <td className="p-3.5 text-stone-600">按残基长度精确加权平均，统一保留 3 位小数（<code>:.3f</code>）。</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-stone-900">不稳定指数 (II)</td>
                  <td className="p-3.5 font-mono">(10/L) ∑_&#123;i=1..L-1&#125; DIWV(aa_i, aa_&#123;i+1&#125;)</td>
                  <td className="p-3.5 font-mono">(L_VH·II_VH + L_VL·II_VL)/(L_VH+L_VL)</td>
                  <td className="p-3.5 text-stone-600"><strong>消除跨链伪二肽误差</strong>：分别仅扫描 VH 内部 (L_VH − 1) 个和 VL 内部 (L_VL − 1) 个真实肽键后再按长度加权。</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Biopython Bjellqvist pKa Table */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm">Biopython ProtParam (Bjellqvist et al.) 精确解离常数 pKa 参数表</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              前后端所有 <code>pI</code> 与 <code>Charge_pH7.4</code> 均统一采用与 <code>Bio.SeqUtils.ProtParam.ProteinAnalysis</code> 完全一致的侧链及首尾残基特异性末端 pKa 表：
            </p>
            <div className="p-4 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs space-y-1.5 overflow-x-auto">
              <div><span className="text-emerald-400">• 碱性正电侧链 (Positive Charged):</span>  Lys (K) = 10.00,  Arg (R) = 12.00,  His (H) = 5.98</div>
              <div><span className="text-emerald-400">• 酸性负电侧链 (Negative Charged):</span>  Asp (D) = 4.05,   Glu (E) = 4.45,   Cys (C) = 9.00,   Tyr (Y) = 10.00</div>
              <div><span className="text-emerald-400">• 游离 N-端 α-NH₃⁺ (按首残基特异):</span>  Ala=7.59, Met=7.00, Ser=6.93, Pro=8.36, Thr=6.82, Val=7.44, Glu=7.70, 其他默认=7.50</div>
              <div><span className="text-emerald-400">• 游离 C-端 α-COO⁻ (按末残基特异):</span>  Asp=4.55, Glu=4.75, 其他默认=3.55</div>
            </div>
          </div>
        </div>
      );

    case 'ptm':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 06 · 03. Gold-Standard 4-Tier PTM &amp; IMGT Hotspots</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">03 板块：工业界金标准 4 级 PTM 风险分层与环区过滤开关</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              翻译后修饰（PTM）与化学降解不仅取决于一级序列模体（Motif），更受<strong>三维局部二级结构柔性（Loop vs. β-Strand）</strong>与<strong>侧链溶剂可及度（Exposed RSA ≥ 7.5% vs. Buried）</strong>的严格支配。例如，天冬酰胺脱酰胺与天冬氨酸异构化必须经历环状琥珀酰亚胺（Succinimide / Asu）五元环过渡态，这要求主链二面角 (φ, ψ) 具备高度局部构象自由度；位于刚性 β-折叠股或内部包埋区的相同序列模体在真实加速稳定性实验中几乎不发生反应。
            </p>
          </div>

          {/* 6.1 4-Tier Gold Standard Table */}
          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-900 text-white">
                  <th className="p-3.5 font-semibold">风险等级 (Risk Tier)</th>
                  <th className="p-3.5 font-semibold">UI 色阶</th>
                  <th className="p-3.5 font-semibold">涵盖修饰类别与精确序列模体 (Motifs)</th>
                  <th className="p-3.5 font-semibold">3D 结构触发条件 (Structural Gating)</th>
                  <th className="p-3.5 font-semibold">物理化学机理与工业界决策</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                <tr>
                  <td className="p-3.5 font-bold text-rose-800">Tier 1 · Intolerable<br /><span className="text-[11px] font-normal text-stone-500">零容忍级缺陷</span></td>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-rose-600 text-white">RED</span></td>
                  <td className="p-3.5 font-mono font-bold text-stone-900">
                    • Unpaired Free Cys (C)<br />
                    • N-Glycosylation (N-X-S/T, X≠P)
                  </td>
                  <td className="p-3.5 text-stone-600">
                    • Free Cys：经 3D 1-to-1 链内/跨链二硫键配对（Sγ–Sγ ≤ 3.5 Å，或弛豫 Cβ–Cβ ≤ 5.0 Å 且 Sγ–Sγ ≤ 5.5 Å，缺 Sγ 时 Cβ–Cβ ≤ 4.8 Å，保守 23–104 结合 Cα–Cα ≤ 7.5 Å）后仍未配对（任何位置）<br />
                    • N-Glyc：经零宽先行断言重叠扫描检出的 N-X-S/T（X≠P）位于激活的 CDR/FR 区（无论暴露或环区）
                  </td>
                  <td className="p-3.5 text-stone-600">游离巯基引发二硫键错配与共价二聚体；Fab 糖基化导致严重批次异质性与免疫原性，<strong>必须优先突变消除</strong>。</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-rose-700">Tier 2 · High Risk<br /><span className="text-[11px] font-normal text-stone-500">高危化学降解热点</span></td>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-rose-600 text-white">RED</span></td>
                  <td className="p-3.5 font-mono font-bold text-stone-900">
                    • Deamidation: NG<br />
                    • Isomerization: DG
                  </td>
                  <td className="p-3.5 font-mono text-rose-800 font-semibold">
                    Exposed (RSA ≥ 7.5%)<br />AND in Loops ([*-Loop,Exp])
                  </td>
                  <td className="p-3.5 text-stone-600">+1 位甘氨酸（Gly）无侧链空间位阻，琥珀酰亚胺环化半衰期仅数天，40°C 加速稳定性极易失活，<strong>强烈建议工程改造</strong>。</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-amber-800">Tier 3 · Moderate Risk<br /><span className="text-[11px] font-normal text-stone-500">中危需关注热点</span></td>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-amber-100 text-amber-800 border border-amber-300">AMBER</span></td>
                  <td className="p-3.5 font-mono font-bold text-stone-900">
                    • Oxidation: M, W<br />
                    • Deamidation: NS, NT, NN, NH<br />
                    • Isomerization: DS, DD
                  </td>
                  <td className="p-3.5 font-mono text-amber-800 font-semibold">
                    Exposed (RSA ≥ 7.5%)<br />AND in Loops ([*-Loop,Exp])
                  </td>
                  <td className="p-3.5 text-stone-600">暴露柔性环区上的甲硫氨酸 <code>M</code> 与色氨酸 <code>W</code> 易发生光/自由基氧化；<code>NS/NT/NN/NH</code> 与 <code>DS/DD</code> 具中等速率环化风险，需结合制剂缓冲液管控。</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-emerald-800">Tier 4 · Low Risk<br /><span className="text-[11px] font-normal text-stone-500">低危慢速全集位点</span></td>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">L-GREEN</span></td>
                  <td className="p-3.5 font-mono text-stone-800">
                    • Other 15 Nx (含 NP)<br />
                    • Other 17 Dx (含 DP)
                  </td>
                  <td className="p-3.5 font-mono text-emerald-800 font-semibold">
                    Exposed (RSA ≥ 7.5%)<br />AND in Loops ([*-Loop,Exp])
                  </td>
                  <td className="p-3.5 text-stone-600">+1 位大侧链位阻或脯氨酸无酰胺氢使得生理 pH 下环化极慢（注：<code>DP</code> 仅在强酸 pH &lt; 4.5 高温下发生酸水解，常规制剂为低危 <code>L-GREEN</code>）。</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-emerald-900">Protected / None<br /><span className="text-[11px] font-normal text-stone-500">3D 构象保护或无模体</span></td>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-emerald-700 text-white">D-GREEN</span></td>
                  <td className="p-3.5 font-mono text-stone-600">
                    Any Nx, Dx, M, W
                  </td>
                  <td className="p-3.5 font-mono text-stone-600">
                    Buried (RSA &lt; 7.5%)<br />OR in β-Strand ([*-Strand])
                  </td>
                  <td className="p-3.5 text-stone-600">如保守锚点 <code>IMGT Trp41 / Trp118 [FR-Strand,Buried]</code> 或骨架 β-股上的模体，受三维空间掩埋或主链氢键刚性锁定，无实际降解风险。</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 6.2 CDR-Loop Only vs + FR-Loop Toggle */}
          <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-bold text-emerald-950 text-sm">
                6.2 双模式交互开关：CDR-Loop Only (Default) vs. + FR-Loop (Extended)
              </h4>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-700 text-white">
                01 与 03 板块 100% 严丝合缝
              </span>
            </div>
            <p className="text-xs text-emerald-900 leading-relaxed">
              在 <strong>Results &amp; Compare → 03. PTM &amp; IMGT Hotspots</strong> 标题栏右侧，系统提供了实时生效的环区作用域切换开关：
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-white rounded-xl border border-emerald-200">
                <div className="font-bold text-stone-900 mb-1">模式 A：CDR-Loop Only (Default · 默认推荐)</div>
                <p className="text-stone-600 leading-relaxed text-[11px]">
                  • <strong>风险警报仅聚焦于抗原结合高变区环（<code>[CDR-Loop,Exp]</code>）</strong>，与 01 板块的 IMGT CDR 边界（27–38, 56–65, 105–117）100% 对齐；
                  <br />• 所有位于骨架区（<code>[FR-Loop]</code>、<code>[FR-Strand]</code>）以及 CDR 刚性茎区（<code>[CDR-Strand]</code>）或包埋区（<code>[*,Buried]</code>）的位点，统一归入单元格底部的 <code>Protected: ...</code> 保护态列表中，彻底消除天然胚系骨架保守位点造成的假阳性报警。
                </p>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-amber-200">
                <div className="font-bold text-stone-900 mb-1">模式 B：+ FR-Loop (Extended · 扩展全环区模式)</div>
                <p className="text-stone-600 leading-relaxed text-[11px]">
                  • 一键开启后，<strong>将骨架区表面暴露的柔性转角环（<code>[FR-Loop,Exp]</code>，如 FR3 D-E &quot;CDR4&quot; 环 IMGT 81–86 或 FR1/FR2 暴露转角）同步纳入 Tier 1–4 风险评级与颜色高亮</strong>；
                  <br />• 适用于深度人源化改造、回复突变（Back-mutation）、去免疫化或从头设计（De novo design）抗体的全方位 CMC 质量排查。
                </p>
              </div>
            </div>
          </div>
        </div>
      );

    case 'schema':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 07 · Canonical Data Dictionary</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">统一规范 Schema 数据字典（TAP 52 列 / TNP 30 列）与位点 Token 语法</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              Python 批处理脚本（<code>TAP_2024_Batch.py</code> 与 <code>TNP_2025_Batch.py</code>）、系统内置临床参考库（<code>Analysis_Results_TAP.csv</code> 与 <code>Analysis_Results_TNP.csv</code>）以及前端导出表格严格遵循统一的列结构规范。
            </p>
          </div>

          {/* 7.1 PTM Token Grammar */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm">7.1 3D 结构 PTM 位点标注语法（Token Grammar）</h4>
            <div className="p-4 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs space-y-2 overflow-x-auto">
              <div className="text-emerald-400 font-bold">标准位点 Token 格式：  &lt;SeqPos&gt;@IMGT&lt;Num&gt;(&lt;Motif&gt;)[&lt;Region&gt;-&lt;SecStruct&gt;,&lt;Exposure&gt;]</div>
              <div>• 示例 1 (Tier 2 RED 高危脱酰胺):     54@IMGT58(NG)[CDR-Loop,Exp]</div>
              <div>• 示例 2 (Tier 3 AMBER 中危氧化):     101@IMGT109(M)[CDR-Loop,Exp]</div>
              <div>• 示例 3 (Tier 4 L-GREEN 低危慢速):   99@IMGT107(DP)[CDR-Loop,Exp]  或  52@IMGT56(NP)[CDR-Loop,Exp]</div>
              <div>• 示例 4 (D-GREEN 3D 折叠股/包埋保护): 36@IMGT41(W)[FR-Strand,Buried]</div>
              <div className="text-stone-400 pt-1">
                单元格完整汇总格式： &quot;&lt;TotalCount&gt; (High: ... | Mod: ... | Low: ... | Protected: ...)&quot;
              </div>
            </div>
          </div>

          {/* 7.2 Column Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-900 text-sm">TAP 2024 传统单抗（共 52 列）</h4>
                <span className="px-2 py-0.5 text-[11px] font-mono bg-stone-900 text-white rounded">52 Columns</span>
              </div>
              <ul className="text-xs text-stone-600 space-y-1.5 font-mono">
                <li><strong>[1] 标识列 (1 列)</strong>: Antibody_ID</li>
                <li><strong>[2–6] 01. 3D 表面与构象 (5 列)</strong>: Total_CDR_Length, PSH, PPC, PNC, SFvCSP</li>
                <li><strong>[7–24] 02. 生物物理属性 (18 列)</strong>:
                  <br />• 双链 Fv (6 列): VHVL_Len, VHVL_MW, VHVL_pI, VHVL_GRAVY, VHVL_Instability, VHVL_Charge_pH7.4
                  <br />• 重链 VH (6 列): VH_Len, VH_MW, VH_pI, VH_GRAVY, VH_Instability, VH_Charge_pH7.4
                  <br />• 轻链 VL (6 列): VL_Len, VL_MW, VL_pI, VL_GRAVY, VL_Instability, VL_Charge_pH7.4
                </li>
                <li><strong>[25–42] 03. 金标准 4 级 PTM (18 列)</strong>:
                  <br />• 双链 Fv (6 列): VHVL_NGlyc, VHVL_Deamidation, VHVL_Isomerization, VHVL_Oxidation, VHVL_FreeCys, VHVL_Cys
                  <br />• 重链 VH (6 列): VH_NGlyc, VH_Deamidation, VH_Isomerization, VH_Oxidation, VH_FreeCys, VH_Cys
                  <br />• 轻链 VL (6 列): VL_NGlyc, VL_Deamidation, VL_Isomerization, VL_Oxidation, VL_FreeCys, VL_Cys
                </li>
                <li><strong>[43–52] 序列与 CDR 详情 (10 列)</strong>:CDR_H1, CDR_H2, CDR_H3, CDR_L1, CDR_L2, CDR_L3, Heavy_Chain_Name, Light_Chain_Name, VH_Sequence, VL_Sequence</li>
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-900 text-sm">TNP 2025 纳米抗体（共 30 列）</h4>
                <span className="px-2 py-0.5 text-[11px] font-mono bg-stone-900 text-white rounded">30 Columns</span>
              </div>
              <ul className="text-xs text-stone-600 space-y-1.5 font-mono">
                <li><strong>[1] 标识列 (1 列)</strong>: Nanobody_ID</li>
                <li><strong>[2–8] 01. 3D 表面与构象 (7 列)</strong>: Total_CDR_Length_L, CDR3_Length_L3, CDR3_Compactness_C, PSH, PPC, PNC, FR2_Hallmark_Tetrad</li>
                <li><strong>[9–14] 02. 生物物理属性 (6 列)</strong>: VHH_Len, VHH_MW, VHH_pI, VHH_GRAVY, VHH_Instability, VHH_Charge_pH7.4</li>
                <li><strong>[15–20] 03. 金标准 4 级 PTM (6 列)</strong>: VHH_NGlyc, VHH_Deamidation, VHH_Isomerization, VHH_Oxidation, VHH_FreeCys, VHH_Cys</li>
                <li><strong>[21–30] 骨架四联体位点与序列详情 (10 列)</strong>: IMGT_42, IMGT_49, IMGT_50, IMGT_52, CDR1, CDR2, CDR3, VHH_Chain_Name, VHH_Sequence, Notes</li>
              </ul>
            </div>
          </div>
        </div>
      );

    case 'architecture':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 08 · System Architecture &amp; Remote HPC</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">系统全栈架构与远程 Linux HPC 集群批处理</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              AbDev Studio 采用 <strong>React 19 + TypeScript + Tailwind CSS + Express 全栈架构</strong>，并内置 <code>ssh2</code> 远程集群调度器与 Python 多进程（<code>multiprocessing.Pool</code>）并行计算脚本。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>前后端双引擎同构与实时重分级</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                • <strong>后端分析与统计层 (<code>/src/server/stats.ts</code>)</strong>：负责加载 <code>Analysis_Results_TAP.csv</code> 与 <code>Analysis_Results_TNP.csv</code> 临床基线库，在内存中按 4 维过滤条件实时计算线性插值分位数（P5, P25, P50, P75, P95, Min, Max）及直方图分箱；
                <br />• <strong>前端动态重解析引擎 (<code>ResultsViewer.tsx</code>)</strong>：当用户在 UI 上切换 <code>CDR-Loop Only (Default)</code> 与 <code>+ FR-Loop (Extended)</code> 时，前端直接解析每个位点 Token 的三维标签（<code>[CDR-Loop,Exp]</code> vs <code>[FR-Loop,Exp]</code>），零延迟重算高/中/低危计数与单元格色阶。
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                <Code2 className="w-4 h-4 text-emerald-700" />
                <span>远程 SSH 3D 参考库重校准与命令行用法</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                在 <strong>Settings → Section 3 (Reference Database Management)</strong> 中，您可以直接下载最新的 <code>TAP_2024_Batch.py</code> 与 <code>TNP_2025_Batch.py</code> 脚本，或一键连接远程 Linux 服务器，对远程 3D PDB 目录自动执行全量重算并回传更新本地参考库：
              </p>
              <div className="p-3 bg-stone-900 text-emerald-300 rounded-xl font-mono text-[11px] overflow-x-auto">
                python3 TAP_2024_Batch.py /path/to/mAb_PDBs [num_cores]<br />
                python3 TNP_2025_Batch.py /path/to/VHH_PDBs [num_cores]
              </div>
            </div>
          </div>
        </div>
      );

    case 'bestpractices':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 09 · Engineering Best Practices</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">治疗性抗体与纳米抗体工程成药性排雷指南</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              结合临床失败与获批抗体的真实经验，以下为使用 AbDev Studio 进行候选分子筛选与理性突变设计的五大黄金法则：
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <div className="font-bold text-stone-900 text-sm mb-1">1. 表面疏水斑块（PSH &gt; P95）与高浓度聚集拆解</div>
              <p className="text-stone-600 leading-relaxed">
                当单抗或 VHH 的 <code>PSH</code> 触发 <strong>AMBER / RED</strong> 警报（如 TAP PSH &gt; 151.3）时，通常是由于 CDRH3 或 CDRL3 表面存在连续暴露的色氨酸/苯丙氨酸/异亮氨酸簇。建议在不破坏核心结合能的前提下，将边缘暴露疏水残基突变为酪氨酸（Tyr，兼具氢键供体与芳香环）或极性丝氨酸/苏氨酸（Ser/Thr），可显著降低 HIC 滞留时间与自聚集倾向。
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <div className="font-bold text-stone-900 text-sm mb-1">2. 正电荷斑块（PPC &gt; P95）与体内异常快清除（Fast Clearance）</div>
              <p className="text-stone-600 leading-relaxed">
                若 <code>PPC</code> 过高（如 &gt; 0.99）且 <code>VHVL_pI &gt; 9.2</code>，抗体极易与血管内皮负电糖胺聚糖（HSPG）发生非特异静电粘附（典型反例如临床撤回的 Bococizumab）。可通过将 CDR 外围非关键的 Arg/Lys 突变为 Gln/Asn 或引入邻近 Glu/Asp 形成分子内盐桥来消除正电斑块。
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <div className="font-bold text-stone-900 text-sm mb-1">3. 重轻链电荷严重反号（SFvCSP &lt; −6.3 e²）与高浓度粘度激增</div>
              <p className="text-stone-600 leading-relaxed">
                对于皮下注射高浓度单抗制剂（&gt; 120 mg/mL），必须同时核查 <code>SFvCSP</code>、<code>VH_pI</code> 与 <code>VL_pI</code>。若重链带强正电而轻链带强负电（<code>SFvCSP</code> 为强负值），分子间首尾偶极吸引会导致粘度失控。应通过轻链骨架置换或表面电荷微调使 VH 与 VL 同号（<code>SFvCSP ≥ 0</code>）。
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <div className="font-bold text-stone-900 text-sm mb-1">4. 纳米抗体（VHH）人源化中的 FR2 四联体与 CDR3 回折协同</div>
              <p className="text-stone-600 leading-relaxed">
                切忌在纳米抗体人源化时将 FR2 特征四联体（IMGT 42, 49, 50, 52，天然驼源为亲水的 <code>FERF / FERG / YQRL</code>）盲目突变为传统人类 VH 的疏水四联体 <code>VGLW</code>！特别是当 CDR3 较短或紧凑度 <code>C</code> 较低（外伸构象）时，暴露的 <code>VGLW</code> 会导致 <code>TNP_PSH</code> 暴增并引发不可逆热聚集。
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <div className="font-bold text-stone-900 text-sm mb-1">5. 精准利用 3D 环区与暴露度进行 PTM 减法工程（避免过度突变损失亲和力）</div>
              <p className="text-stone-600 leading-relaxed">
                在 PTM 排雷时，优先消除 <strong>Tier 1 (RED: 游离 Cys、N-糖基化)</strong> 与 <strong>Tier 2 (RED: 暴露环区 <code>NG / DG</code>)</strong>；对 <strong>Tier 3 (AMBER: 暴露环区 <code>M, W, NS, NT, NN, NH, DS, DD</code>)</strong> 进行加速稳定性实验验证；而对于被系统标为 <strong>Tier 4 (L-GREEN: 如 <code>DP, NP</code> 等慢速位点)</strong> 或 <strong>Protected (D-GREEN: 位于 <code>[*-Strand]</code> 或 <code>[*,Buried]</code>)</strong> 的位点，切勿盲目突变，以免破坏抗体核心折叠桶或损失抗原亲和力。
              </p>
            </div>
          </div>
        </div>
      );
  }
}

/* ============================================================================
 * ENGLISH DOCUMENTATION CONTENT (v3.5 Comprehensive Edition)
 * ============================================================================ */
function EnDocContent({ activeSection }: { activeSection: DocSectionId }) {
  switch (activeSection) {
    case 'quickstart':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 01 · Quick Start</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">Quick Start &amp; End-to-End 3D Workflow</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              <strong>AbDev Studio (Antibody &amp; Nanobody Developability Workbench)</strong> is a pure <strong>3D structure-driven developability assessment platform</strong> for therapeutic monoclonal antibodies (mAb Fv: VH + VL) and single-domain nanobodies (VHH). It benchmarks candidate 3D structures and biophysical properties against the Oxford Protein Informatics Group (OPIG) <strong>TAP (2024, N = 1,121)</strong> and <strong>TNP (2025, N = 39)</strong> clinical reference distributions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="text-xs font-mono font-bold text-emerald-700">STEP 1 · Modality Selection &amp; Data Ingestion</div>
              <h4 className="font-bold text-stone-900 text-sm">Dual-Modality Engine (TAP 2024 vs. TNP 2025)</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Switch between <strong>TAP (2024) · Conventional mAb (VH+VL)</strong> and <strong>TNP (2025) · Nanobody (VHH)</strong>:
                <br />• <strong>Local 3D PDB/CIF Upload</strong>: Upload <code>.pdb</code> or <code>.cif</code> structures generated by ABodyBuilder2, NanoBodyBuilder2, AlphaFold3, or X-ray crystallography.
                <br />• <strong>Remote Linux HPC Execution</strong>: Connect via SSH to a remote cluster equipped with <code>ANARCI</code> and <code>Joy PSA</code> for high-throughput parallel batch processing.
                <br />• <strong>Pre-computed CSV Import</strong>: Upload <code>Analysis_Results_TAP.csv</code> (52 columns) or <code>Analysis_Results_TNP.csv</code> (30 columns) directly.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="text-xs font-mono font-bold text-emerald-700">STEP 2 · 4D Clinical Reference Filtering</div>
              <h4 className="font-bold text-stone-900 text-sm">Dynamic Sub-Cohort Benchmarking</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Slice the clinical reference database dynamically across 4 orthogonal dimensions:
                <br />1. <strong>Clinical Stage</strong>: Approved, Phase I / II / III, Preregistration;
                <br />2. <strong>Heavy / VHH Germline Subtype</strong>: e.g., <code>IGHV1</code>, <code>IGHV3</code>, <code>IGHV4</code>;
                <br />3. <strong>Light Chain Subtype</strong>: <code>KAPPA (κ)</code> vs. <code>LAMBDA (λ)</code>;
                <br />4. <strong>Molecular Format</strong>: Whole mAb, Bispecific, Fab, scFv, VHH.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="text-xs font-mono font-bold text-emerald-700">STEP 3 · 3-Section Profiling &amp; Loop Scope Switch</div>
              <h4 className="font-bold text-stone-900 text-sm">01 3D Surface · 02 Physicochemical · 03 PTM Hotspots</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                • <strong>01. 3D Surface &amp; CDR</strong>: Inspect CDR lengths, PSH, PPC, PNC, SFvCSP (mAb), or CDR3 Compactness (C) and FR2 Hallmark Tetrad (VHH);
                <br />• <strong>02. Physicochemical</strong>: Evaluate two-chain coupled <code>VHVL_pI</code>, net charge at pH 7.4, GRAVY, and Guruprasad Instability Index;
                <br />• <strong>03. PTM &amp; IMGT Hotspots</strong>: Defaults to <strong>CDR-Loop Only (Default)</strong> (100% aligned with Section 01 CDR boundaries), with an interactive toggle for <strong>+ FR-Loop (Extended)</strong> to include exposed framework loops.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="text-xs font-mono font-bold text-emerald-700">STEP 4 · Interactive Histograms &amp; Export</div>
              <h4 className="font-bold text-stone-900 text-sm">Multi-Target Overlay &amp; Color-Coded Reports</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                • Click any row to expand full-metric clinical distribution histograms with exact P5/P25/P75/P95 boundaries;
                <br />• Select up to 10 candidates for side-by-side distribution overlay;
                <br />• Export color-coded <strong>Excel (.xlsx)</strong>, raw <strong>CSV</strong>, or standalone interactive <strong>HTML reports</strong>.
              </p>
            </div>
          </div>
        </div>
      );

    case 'pipeline3d':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 02 · Pure 3D Structural Engine</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">3D IMGT Numbering · Kabsch-Sander DSSP · Joy PSA Engine</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              Every antibody processed by AbDev Studio is backed by a 3D structure (<code>.pdb</code> / <code>.cif</code>) with <strong>zero sequence-only fallbacks</strong>. Both <code>TAP_2024_Batch.py</code> and <code>TNP_2025_Batch.py</code> execute a unified 3-stage structural biology pipeline:
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm">1. ANARCI IMGT Numbering &amp; Insertion-Code Mapping</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Sequences extracted from PDB coordinates (<code>Bio.SeqUtils.seq1(..., custom_map=&#123;&quot;UNK&quot;: &quot;X&quot;&#125;)</code>) are numbered via <code>ANARCI --scheme imgt</code>:
              <br />• <strong>IMGT CDR Regions</strong>: <code>CDR1 = 27–38</code>, <code>CDR2 = 56–65</code>, <code>CDR3 = 105–117</code> (including symmetrical insertion codes such as <code>111A, 111B, 112B, 112A</code>);
              <br />• <strong>IMGT Framework Regions (FR)</strong>: <code>FR1 = 1–26</code>, <code>FR2 = 39–55</code>, <code>FR3 = 66–104</code>, <code>FR4 = 118–128</code>.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm">2. 3D Kabsch-Sander DSSP Hydrogen-Bond Engine: Distinguishing Loops vs. β-Strands</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              <strong>Why IMGT CDR ranges alone are not identical to physical loops</strong>: The terminal anchor stems of IMGT CDRs (e.g., IMGT 27–28, 37–38, 56–57, 64–65, 105–106, 116–117) frequently form hydrogen-bonded antiparallel β-strands extending from the immunoglobulin β-barrel, whereas IMGT Framework regions (FR1/FR2/FR3) contain surface-exposed inter-strand turn loops (such as the FR3 D–E &quot;CDR4&quot; loop).
            </p>
            <div className="p-4 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs space-y-1.5 overflow-x-auto">
              <div className="text-emerald-400 font-bold"># Kabsch &amp; Sander (1983) Biopolymers 22:2577-2637 Backbone Electrostatic H-Bond Energy</div>
              <div>E(C=O_i, N-H_j) = 0.42 × 0.20 × 332.0 × (1/r_ON + 1/r_CH − 1/r_OH − 1/r_CN) &lt; −0.5 kcal/mol</div>
              <div className="text-stone-400">• Residues participating in ≥ 2 consecutive antiparallel or parallel β-Sheet bridges (|i − j| ≥ 3) are assigned as β-Strand; all other residues are assigned as flexible Loop.</div>
              <div className="text-emerald-300">• 4 Composite Structural Tags: [CDR-Loop], [CDR-Strand], [FR-Loop], [FR-Strand]</div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm">3. Joy PSA Relative Side-Chain Solvent Accessibility (RSA ≥ 7.5%)</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Solvent accessibility is computed on the intact 3D structure (the full VH+VL heterodimer for mAbs, or the single VHH domain for nanobodies) using Joy <code>psa</code>. A residue is classified as surface-exposed (<code>Exp</code>) if and only if its <strong>Relative Side-Chain Surface Accessibility (RSA_side-chain ≥ 7.5%)</strong> (columns 50–55 of the <code>.asa</code> output), and buried (<code>Buried</code>) otherwise.
            </p>
          </div>
        </div>
      );

    case 'tier5':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 03 · 5-Tier Quantitative Rating</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">5-Tier Percentile Color System &amp; Two-Sided Outlier Detection</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              Quantitative metrics in Sections 01 and 02 are evaluated against the empirical percentiles (<code>P5, P25, P50, P75, P95, Min, Max</code>) of the dynamically filtered clinical reference cohort:
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-900 text-white">
                  <th className="p-3.5 font-semibold">Tier Badge</th>
                  <th className="p-3.5 font-semibold">Percentile Interval</th>
                  <th className="p-3.5 font-semibold">Quantitative Meaning (01 3D &amp; 02 Biophysical)</th>
                  <th className="p-3.5 font-semibold">Qualitative PTM Meaning (03 PTM Hotspots)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                <tr>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-emerald-700 text-white">D-GREEN</span></td>
                  <td className="p-3.5 font-mono font-bold text-emerald-800">25% – 75% (IQR Core)</td>
                  <td className="p-3.5 text-stone-600">Inside the central 50% interquartile range of clinical antibodies.</td>
                  <td className="p-3.5 text-stone-600"><strong>Protected / None</strong>: No PTM motif, or all motifs are buried (RSA &lt; 7.5%) / locked in rigid β-strands (<code>[*-Strand]</code>).</td>
                </tr>
                <tr>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">L-GREEN</span></td>
                  <td className="p-3.5 font-mono font-bold text-emerald-700">5% – 25% or 75% – 95%</td>
                  <td className="p-3.5 text-stone-600">Within the central 90% clinical distribution (normal variation).</td>
                  <td className="p-3.5 text-stone-600"><strong>Tier 4 Low Risk</strong>: Slow deamidation (other 15 <code>Nx</code> incl. <code>NP</code>) or slow isomerization/cleavage (other 17 <code>Dx</code> incl. <code>DP</code>) in exposed loops.</td>
                </tr>
                <tr>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-amber-100 text-amber-800 border border-amber-300">AMBER</span></td>
                  <td className="p-3.5 font-mono font-bold text-amber-700">[Min, 5%) or (95%, Max]</td>
                  <td className="p-3.5 text-stone-600">In the extreme 5% lower or upper tail of the clinical cohort.</td>
                  <td className="p-3.5 text-stone-600"><strong>Tier 3 Moderate Risk</strong>: Exposed loop <code>M, W</code> (oxidation), <code>NS, NT, NN, NH</code> (deamidation), or <code>DS, DD</code> (isomerization).</td>
                </tr>
                <tr>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-rose-600 text-white">RED</span></td>
                  <td className="p-3.5 font-mono font-bold text-rose-700">&lt; Min or &gt; Max</td>
                  <td className="p-3.5 text-stone-600">Exceeds the historical minimum or maximum of the clinical cohort.</td>
                  <td className="p-3.5 text-stone-600"><strong>Tier 1 Intolerable &amp; Tier 2 High Risk</strong>: Unpaired <code>Free Cys</code>, <code>N-X-S/T</code> glycosylation, or exposed loop <code>NG / DG</code>.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'algo3d':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 04 · 01. 3D Surface &amp; CDR Mathematical Specification</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">Exact Mathematical Formulations for 01. 3D Surface &amp; CDR Metrics</h3>
          </div>

          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="font-bold text-stone-900 text-sm">CDR Vicinity Seed, Salt-Bridge Neutralization &amp; Heavy-Atom Distance</h4>
            <ul className="text-xs text-stone-600 space-y-2 leading-relaxed">
              <li>• <strong>CDR Vicinity (V_CDR)</strong>: Includes all surface-exposed residues (RSA_side-chain ≥ 7.5%) within <code>IMGT_CDR_ANCHORS = [25–40, 54–67, 103–119]</code> plus any surface-exposed framework residue whose heavy atoms come within ≤ 4.0 Å of any seed heavy atom.</li>
              <li>• <strong>Salt-Bridge Hydrophobicity Reset</strong>: Any Asp/Glu side-chain oxygen (<code>OD1, OD2, OE1, OE2</code>) within &lt; 3.2 Å of any Arg/Lys/His side-chain nitrogen (<code>NH1, NH2, NE, NZ, ND1, NE2</code>) has its normalized Kyte-Doolittle hydrophobicity reset to Glycine (H ← H_Gly = 1.4545), while keeping its electrostatic charge q.</li>
              <li>• <strong>Minimum Inter-Residue Heavy-Atom Distance (r_ij)</strong>: r_ij = min_&#123;a ∈ i, b ∈ j&#125; ||x_a − x_b||₂ across all non-hydrogen heavy atoms, evaluated for all pairs with 0 &lt; r_ij &lt; 7.5 Å.</li>
            </ul>
            <div className="p-4 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs space-y-2 overflow-x-auto">
              <div>• PSH = 2 × ∑_&#123;i &lt; j ∈ V_CDR, r_ij &lt; 7.5Å&#125; (H_i · H_j) / r_ij²   (H ∈ [1.0, 2.0])</div>
              <div>• PPC = 2 × ∑_&#123;i &lt; j ∈ V_CDR, q_i&gt;0, q_j&gt;0, r_ij &lt; 7.5Å&#125; (q_i · q_j) / r_ij²   (q_R=q_K=+1.0, q_H=+0.1)</div>
              <div>• PNC = 2 × ∑_&#123;i &lt; j ∈ V_CDR, q_i&lt;0, q_j&lt;0, r_ij &lt; 7.5Å&#125; (|q_i| · |q_j|) / r_ij²   (|q_D|=|q_E|=1.0)</div>
              <div>• SFvCSP (mAb) = (∑_&#123;i ∈ Exposed(VH)&#125; q_i) × (∑_&#123;j ∈ Exposed(VL)&#125; q_j)   [e²]</div>
              <div>• CDR3 Compactness C (VHH) = L3 / || Centroid_bb(IMGT 105–117) − Centroid_bb(IMGT 102, 103, 118, 119) ||₂   [AA / Å, backbone N, CA, C]</div>
            </div>
          </div>
        </div>
      );

    case 'algo1d':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 05 · 02. Two-Chain Coupled Biophysical Math</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">Two-Chain Coupled vs. Single-Chain Biophysical Algorithms</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              Both Python batch scripts and the TypeScript calculation engine strictly enforce heterodimer physical conservation laws and the exact <strong>Biopython <code>Bio.SeqUtils.ProtParam</code> (Bjellqvist et al.) pKa table</strong>:
            </p>
          </div>

          <div className="p-4 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs space-y-2 overflow-x-auto">
            <div><span className="text-emerald-400">• Two-Chain Molecular Weight:</span>  VHVL_MW = MW(VH) + MW(VL)   [2 separate chains, 2×18.0153 Da terminal water retained]</div>
            <div><span className="text-emerald-400">• Two-Chain Coupled pI:</span>        Solve Z_VH(pH) + Z_VL(pH) = 0 on pH ∈ [0, 14] via 60-step bisection (2 N-termini + 2 C-termini)</div>
            <div><span className="text-emerald-400">• Two-Chain Net Charge (7.4):</span>  VHVL_Charge_pH7.4 = Z_VH(7.40) + Z_VL(7.40)</div>
            <div><span className="text-emerald-400">• Length-Weighted GRAVY:</span>       VHVL_GRAVY = (L_VH · GRAVY_VH + L_VL · GRAVY_VL) / (L_VH + L_VL)   [formatted to :.3f]</div>
            <div><span className="text-emerald-400">• Length-Weighted Instability:</span> VHVL_II = (L_VH · II_VH + L_VL · II_VL) / (L_VH + L_VL)   [no artificial cross-chain dipeptide]</div>
            <div className="pt-2 text-stone-400"># Biopython ProtParam (Bjellqvist et al.) pKa Constants:</div>
            <div className="text-stone-300">Pos: K=10.0, R=12.0, H=5.98 | Neg: D=4.05, E=4.45, C=9.0, Y=10.0</div>
            <div className="text-stone-300">N-term: A=7.59, M=7.0, S=6.93, P=8.36, T=6.82, V=7.44, E=7.7, default=7.5 | C-term: D=4.55, E=4.75, default=3.55</div>
          </div>
        </div>
      );

    case 'ptm':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 06 · 03. Gold-Standard 4-Tier PTM &amp; IMGT Hotspots</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">Gold-Standard 4-Tier PTM Risk System &amp; Loop Scope Switch</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              Every PTM motif is gated by its 3D IMGT coordinate, 3D Kabsch-Sander DSSP secondary structure (<code>Loop</code> vs. <code>Strand</code>), and Joy PSA side-chain solvent accessibility (RSA ≥ 7.5% <code>Exp</code> vs. <code>Buried</code>):
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-900 text-white">
                  <th className="p-3.5 font-semibold">Risk Tier</th>
                  <th className="p-3.5 font-semibold">Badge</th>
                  <th className="p-3.5 font-semibold">Motifs</th>
                  <th className="p-3.5 font-semibold">3D Structural Gating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                <tr>
                  <td className="p-3.5 font-bold text-rose-800">Tier 1 · Intolerable</td>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-rose-600 text-white">RED</span></td>
                  <td className="p-3.5 font-mono">Unpaired Free Cys (C); N-Glycosylation (N-X-S/T, X≠P)</td>
                  <td className="p-3.5 text-stone-600">Unpaired Free Cys after strict 1-to-1 intra/inter-chain 3D pairing (Sγ–Sγ ≤ 3.5 Å, or relaxed Cβ–Cβ ≤ 5.0 Å &amp; Sγ–Sγ ≤ 5.5 Å) anywhere; overlapping N-Glyc in active scope.</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-rose-700">Tier 2 · High Risk</td>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-rose-600 text-white">RED</span></td>
                  <td className="p-3.5 font-mono font-bold">NG (Deamidation), DG (Isomerization)</td>
                  <td className="p-3.5 font-mono text-rose-800">Exposed (RSA ≥ 7.5%) &amp; in Loops ([*-Loop,Exp])</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-amber-800">Tier 3 · Moderate Risk</td>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-amber-100 text-amber-800 border border-amber-300">AMBER</span></td>
                  <td className="p-3.5 font-mono font-bold">M, W (Oxidation); NS, NT, NN, NH (Deamidation); DS, DD (Isomerization)</td>
                  <td className="p-3.5 font-mono text-amber-800">Exposed (RSA ≥ 7.5%) &amp; in Loops ([*-Loop,Exp])</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-emerald-800">Tier 4 · Low Risk</td>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">L-GREEN</span></td>
                  <td className="p-3.5 font-mono">All other 15 Nx (incl. NP) and all other 17 Dx (incl. DP)</td>
                  <td className="p-3.5 font-mono text-emerald-800">Exposed (RSA ≥ 7.5%) &amp; in Loops ([*-Loop,Exp])</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-emerald-900">Protected / None</td>
                  <td className="p-3.5"><span className="px-2.5 py-1 rounded-md font-bold bg-emerald-700 text-white">D-GREEN</span></td>
                  <td className="p-3.5 font-mono">Any Nx, Dx, M, W</td>
                  <td className="p-3.5 font-mono text-stone-600">Buried (RSA &lt; 7.5%) OR in β-Strand ([*-Strand])</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'schema':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 07 · Canonical Schema</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">52-Column TAP &amp; 30-Column TNP Canonical Data Dictionary</h3>
          </div>
          <div className="p-4 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs space-y-2 overflow-x-auto">
            <div className="text-emerald-400 font-bold"># Token Format: &lt;SeqPos&gt;@IMGT&lt;Num&gt;(&lt;Motif&gt;)[&lt;CDR|FR&gt;-&lt;Loop|Strand&gt;,&lt;Exp|Buried&gt;]</div>
            <div>• TAP 2024 (52 Columns): Antibody_ID (1) + 01. 3D Surface (5) + 02. Physicochemical (18: VHVL/VH/VL × 6) + 03. PTM Hotspots (18: VHVL/VH/VL × 6) + CDR &amp; Sequence Metadata (10)</div>
            <div>• TNP 2025 (30 Columns): Nanobody_ID (1) + 01. 3D Surface &amp; Tetrad (7) + 02. Physicochemical (6) + 03. PTM Hotspots (6) + Tetrad Positions &amp; Sequence Metadata (10)</div>
          </div>
        </div>
      );

    case 'architecture':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 08 · System Architecture</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">Full-Stack Architecture &amp; Remote HPC Integration</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              Built with React 19, TypeScript, Tailwind CSS, and an Express backend with <code>ssh2</code> remote cluster orchestration. You can download <code>TAP_2024_Batch.py</code>, <code>TNP_2025_Batch.py</code>, and the pre-calibrated reference databases directly from <strong>Settings → Section 3</strong>, or trigger remote SSH calibration on a remote directory of 3D PDB structures.
            </p>
          </div>
        </div>
      );

    case 'bestpractices':
      return (
        <div className="space-y-6 text-stone-700">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold">Chapter 09 · Best Practices</span>
            <h3 className="text-2xl font-bold text-stone-900 mt-1">Antibody &amp; Nanobody Developability Engineering Guidelines</h3>
            <ul className="text-xs text-stone-600 space-y-2.5 leading-relaxed list-disc list-inside">
              <li><strong>Disrupt Surface Hydrophobic Patches (PSH &gt; P95)</strong>: Replace solvent-exposed aromatic/aliphatic clusters on CDR loops with Tyr or Ser/Thr to prevent self-association and high HIC retention.</li>
              <li><strong>Mitigate Positive Charge Patches (PPC &gt; P95)</strong>: Excess positive patches cause non-specific binding to negatively charged endothelial heparan sulfate proteoglycans (HSPG) and rapid in vivo clearance.</li>
              <li><strong>Maintain Fv Charge Symmetry (SFvCSP ≥ 0 e²)</strong>: Opposite net surface charges between VH and VL (strongly negative SFvCSP) drive intermolecular dipole-dipole cross-linking and high viscosity at &gt;120 mg/mL.</li>
              <li><strong>Preserve VHH FR2 Hydrophilic Tetrad (IMGT 42, 49, 50, 52)</strong>: Avoid mutating camelid hydrophilic tetrads (<code>FERF/FERG/YQRL</code>) to hydrophobic human VH-like <code>VGLW</code> unless compensated by a high-compactness (high <code>C</code>) folded-back CDR3.</li>
              <li><strong>Prioritize 3D Structure-Gated PTM Remediation</strong>: Focus mutagenesis on Tier 1 (<code>RED</code>: Free Cys, N-Glyc) and Tier 2 (<code>RED</code>: exposed loop <code>NG/DG</code>), monitor Tier 3 (<code>AMBER</code>: exposed loop <code>M, W, NS, NT, NN, NH, DS, DD</code>), and avoid unnecessary mutations on Tier 4 (<code>L-GREEN</code>: e.g., <code>DP, NP</code>) or 3D-protected (<code>D-GREEN</code>: <code>[*-Strand]</code> or <code>[*,Buried]</code>) residues.</li>
            </ul>
          </div>
        </div>
      );
  }
}
