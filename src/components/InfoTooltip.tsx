import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, BookOpen, Calculator, Sparkles } from 'lucide-react';

export interface MetricMetaItem {
  label: string;
  shortLabel?: string;
  unit?: string;
  summary: string;
  method?: string;
  formula?: string;
  example?: string;
  benchmarkNote?: string;
}

export const METRIC_META: Record<string, MetricMetaItem> = {
  // ============================================================================
  // 1. 3D STRUCTURAL METRICS — TAP 2024 (Conventional mAb · VH+VL)
  // ============================================================================
  L_tot: {
    label: 'TAP 2024 · Total CDR Length (L_tot · 单抗 6 环总 CDR 长度)',
    shortLabel: 'L_tot',
    unit: 'AA',
    summary:
      '传统单抗重链（VH）与轻链（VL）全部 6 个 IMGT 高变环（CDRH1、CDRH2、CDRH3、CDRL1、CDRL2、CDRL3）的氨基酸残基总数。过长的 CDR 环会显著增加抗体的构象熵与溶剂暴露表面积，容易引起疏水自聚集、高浓度溶液粘度升高或蛋白酶水解；过短则可能导致抗原结合接触面积不足。',
    method:
      '通过 ANARCI 将 VH 与 VL 序列按 IMGT 标准编号体系对齐，严格截取各链 IMGT 27–38（CDR1）、56–65（CDR2）、105–117（CDR3，含 111A/112A 等插入码）区间内的非空氨基酸残基并累加求和。按当前筛选激活的临床单抗参考库分位数（P0/P5/P10/P25/P75/P90/P95/P100）进行 5 级色阶判定。',
    formula:
      'L_tot = len(CDRH1: 27–38) + len(CDRH2: 56–65) + len(CDRH3: 105–117) + len(CDRL1: 27–38) + len(CDRL2: 56–65) + len(CDRL3: 105–117)',
    example:
      '• 最优示例（Trastuzumab 曲妥珠单抗）：CDRH1(8) + CDRH2(8) + CDRH3(13) + CDRL1(6) + CDRL2(3) + CDRL3(9) = 47 AA，落入临床单抗 25%–75% 核心区（46–51 AA，标为 D-GREEN）；\n• 预警示例：某含超长 CDRH3（26 AA）及长 CDRL1（12 AA）的抗体 L_tot = 62 AA（> P95 = 56 AA），标为 AMBER/RED，提示构象柔性过大、聚集风险高。',
    benchmarkNote: 'OPIG TAP 2024 临床单抗基线（N = 1,121）：中位数 48 AA，最优区 46–51 AA'
  },
  TAP_L_tot: {
    label: 'TAP 2024 · Total CDR Length (L_tot · 单抗 6 环总 CDR 长度)',
    shortLabel: 'L_tot',
    unit: 'AA',
    summary:
      '传统单抗重链（VH）与轻链（VL）全部 6 个 IMGT 高变环（CDRH1、CDRH2、CDRH3、CDRL1、CDRL2、CDRL3）的氨基酸残基总数。过长的 CDR 环会显著增加抗体的构象熵与溶剂暴露表面积，容易引起疏水自聚集、高浓度溶液粘度升高或蛋白酶水解；过短则可能导致抗原结合接触面积不足。',
    method:
      '通过 ANARCI 将 VH 与 VL 序列按 IMGT 标准编号体系对齐，严格截取各链 IMGT 27–38（CDR1）、56–65（CDR2）、105–117（CDR3，含 111A/112A 等插入码）区间内的非空氨基酸残基并累加求和。按当前筛选激活的临床单抗参考库分位数（P0/P5/P10/P25/P75/P90/P95/P100）进行 5 级色阶判定。',
    formula:
      'L_tot = len(CDRH1: 27–38) + len(CDRH2: 56–65) + len(CDRH3: 105–117) + len(CDRL1: 27–38) + len(CDRL2: 56–65) + len(CDRL3: 105–117)',
    example:
      '• 最优示例（Trastuzumab 曲妥珠单抗）：CDRH1(8) + CDRH2(8) + CDRH3(13) + CDRL1(6) + CDRL2(3) + CDRL3(9) = 47 AA，落入临床单抗 25%–75% 核心区（46–51 AA，标为 D-GREEN）；\n• 预警示例：某含超长 CDRH3（26 AA）及长 CDRL1（12 AA）的抗体 L_tot = 62 AA（> P95 = 56 AA），标为 AMBER/RED，提示构象柔性过大、聚集风险高。',
    benchmarkNote: 'OPIG TAP 2024 临床单抗基线（N = 1,121）：中位数 48 AA，最优区 46–51 AA'
  },
  PSH: {
    label: 'TAP 2024 · Patches of Surface Hydrophobicity (PSH · 单抗 Fv 表面疏水斑块)',
    shortLabel: 'PSH (mAb)',
    unit: 'Score',
    summary:
      '量化传统单抗双链 Fv（VH+VL）三维结构中 CDR 邻域表面暴露的疏水斑块强度。表面疏水斑块是驱动高浓度单抗自聚集（Self-association）、疏水相互作用层析（HIC）滞留时间延长、非特异性多反应性（Polyreactivity）以及高粘度的首要物理因素；若 PSH 极端偏低，则可能提示 CDR 缺乏疏水接触力或模型构象异常。',
    method:
      '严格遵循 OPIG Raybould et al. 双链 Fv 算法：\n(1) 在 VH+VL 复合结构上调用 Joy PSA 计算侧链相对溶剂可及表面积（RSA ≥ 7.5% 定义为表面暴露，自动排除被 VH:VL 界面掩埋的 FR2 残基）；\n(2) 定义 CDR 邻域（CDR Vicinity）为 IMGT CDR+锚点区（IMGT 25–40、54–67、103–119），以及距离上述区域任意重原子 ≤ 4.0 Å 的表面暴露骨架残基；\n(3) 识别分子内盐桥（Asp/Glu 侧链 Oδ/ε 与 Arg/Lys/His 侧链 N 间距 < 3.2 Å），将成盐桥残基疏水值重置为 Gly（H_Gly = 1.4545）；\n(4) 采用正向平移归一化 Kyte-Doolittle 疏水标度 H ∈ [1.0, 2.0]，对所有最小重原子间距 r_ij < 7.5 Å 的暴露残基对（含跨 VH–VL 链的邻近残基对）按距离平方反比加权求和。',
    formula:
      'PSH_Fv = 2 × ∑_{i < j, r_{ij} < 7.5Å} (H_i · H_j) / r_{ij}²   （r_{ij} = min_{a∈i, b∈j} ||x_a − x_b||₂; i, j ∈ Exposed VH+VL CDR Vicinity）',
    example:
      '• 最优示例：临床单抗 PSH 最优核心区（25%–75% IQR）为 117.6–135.2（中位数 125.9，标为 D-GREEN）；\n• 高危示例：某抗体 CDRH3 含有连续暴露的色氨酸/苯丙氨酸/异亮氨酸（如 WYYFDY）且与 CDRL3 暴露的 Tyr 相邻，导致 PSH = 164.8（> P95 = 151.3），标为 AMBER/RED，建议通过极性突变（如 W→Y 或 F→S）拆解疏水斑块。',
    benchmarkNote: 'OPIG TAP 2024 临床单抗基线（N = 1,121）：中位数 125.9，最优区 117.6–135.2'
  },
  TAP_PSH: {
    label: 'TAP 2024 · Patches of Surface Hydrophobicity (PSH · 单抗 Fv 表面疏水斑块)',
    shortLabel: 'PSH (mAb)',
    unit: 'Score',
    summary:
      '量化传统单抗双链 Fv（VH+VL）三维结构中 CDR 邻域表面暴露的疏水斑块强度。表面疏水斑块是驱动高浓度单抗自聚集（Self-association）、疏水相互作用层析（HIC）滞留时间延长、非特异性多反应性（Polyreactivity）以及高粘度的首要物理因素；若 PSH 极端偏低，则可能提示 CDR 缺乏疏水接触力或模型构象异常。',
    method:
      '严格遵循 OPIG Raybould et al. 双链 Fv 算法：\n(1) 在 VH+VL 复合结构上调用 Joy PSA 计算侧链相对溶剂可及表面积（RSA ≥ 7.5% 定义为表面暴露，自动排除被 VH:VL 界面掩埋的 FR2 残基）；\n(2) 定义 CDR 邻域（CDR Vicinity）为 IMGT CDR+锚点区（IMGT 25–40、54–67、103–119），以及距离上述区域任意重原子 ≤ 4.0 Å 的表面暴露骨架残基；\n(3) 识别分子内盐桥（Asp/Glu 侧链 Oδ/ε 与 Arg/Lys/His 侧链 N 间距 < 3.2 Å），将成盐桥残基疏水值重置为 Gly（H_Gly = 1.4545）；\n(4) 采用正向平移归一化 Kyte-Doolittle 疏水标度 H ∈ [1.0, 2.0]，对所有最小重原子间距 r_ij < 7.5 Å 的暴露残基对（含跨 VH–VL 链的邻近残基对）按距离平方反比加权求和。',
    formula:
      'PSH_Fv = 2 × ∑_{i < j, r_{ij} < 7.5Å} (H_i · H_j) / r_{ij}²   （r_{ij} = min_{a∈i, b∈j} ||x_a − x_b||₂; i, j ∈ Exposed VH+VL CDR Vicinity）',
    example:
      '• 最优示例：临床单抗 PSH 最优核心区（25%–75% IQR）为 117.6–135.2（中位数 125.9，标为 D-GREEN）；\n• 高危示例：某抗体 CDRH3 含有连续暴露的色氨酸/苯丙氨酸/异亮氨酸（如 WYYFDY）且与 CDRL3 暴露的 Tyr 相邻，导致 PSH = 164.8（> P95 = 151.3），标为 AMBER/RED，建议通过极性突变（如 W→Y 或 F→S）拆解疏水斑块。',
    benchmarkNote: 'OPIG TAP 2024 临床单抗基线（N = 1,121）：中位数 125.9，最优区 117.6–135.2'
  },
  PPC: {
    label: 'TAP 2024 · Patches of Positive Charge (PPC · 单抗 Fv 正电荷斑块)',
    shortLabel: 'PPC (mAb)',
    unit: 'Score',
    summary:
      '量化传统单抗双链 Fv（VH+VL）在 CDR 邻域表面暴露的正电荷富集程度。过高的正电荷斑块（PPC 偏大）会导致单抗与哺乳动物血管内皮细胞表面带负电的糖胺聚糖（肝素/硫酸乙酰肝素 HSPG）发生非特异性静电吸附，引起特征性的体内异常快速清除（Fast Clearance，半衰期大幅缩短）及脱靶组织滞留。',
    method:
      '在双链 Fv 的 CDR 邻域表面暴露残基（PSA 侧链 RSA ≥ 7.5%）中，赋予生理 pH 7.4 下的正电荷权重（Arg = +1.0, Lys = +1.0, His = +0.1），对所有最小重原子间距 r_ij < 7.5 Å 的正电残基对计算 (q_i · q_j) / r_ij² 并乘以 2。',
    formula:
      'PPC_Fv = 2 × ∑_{q_i > 0, q_j > 0, r_{ij} < 7.5Å} (q_i · q_j) / r_{ij}²   （r_{ij} = min_{a∈i, b∈j} ||x_a − x_b||₂; q_R = q_K = +1.0, q_H = +0.1）',
    example:
      '• 最优示例：临床单抗 PPC 中位数为 0.19，最优区（25%–75% IQR）为 0.05–0.44（标为 D-GREEN）；\n• 高危示例（如 Bococizumab 类似物）：CDRH2 与 CDRL1 密集暴露多个 Arg/Lys（如 RKR 模体），导致 PPC = 1.45（> P95 = 0.99），触发 AMBER/RED 快清除警报。',
    benchmarkNote: 'OPIG TAP 2024 临床单抗基线（N = 1,121）：中位数 0.19，95% 分位阈值 0.99'
  },
  TAP_PPC: {
    label: 'TAP 2024 · Patches of Positive Charge (PPC · 单抗 Fv 正电荷斑块)',
    shortLabel: 'PPC (mAb)',
    unit: 'Score',
    summary:
      '量化传统单抗双链 Fv（VH+VL）在 CDR 邻域表面暴露的正电荷富集程度。过高的正电荷斑块（PPC 偏大）会导致单抗与哺乳动物血管内皮细胞表面带负电的糖胺聚糖（肝素/硫酸乙酰肝素 HSPG）发生非特异性静电吸附，引起特征性的体内异常快速清除（Fast Clearance，半衰期大幅缩短）及脱靶组织滞留。',
    method:
      '在双链 Fv 的 CDR 邻域表面暴露残基（PSA 侧链 RSA ≥ 7.5%）中，赋予生理 pH 7.4 下的正电荷权重（Arg = +1.0, Lys = +1.0, His = +0.1），对所有最小重原子间距 r_ij < 7.5 Å 的正电残基对计算 (q_i · q_j) / r_ij² 并乘以 2。',
    formula:
      'PPC_Fv = 2 × ∑_{q_i > 0, q_j > 0, r_{ij} < 7.5Å} (q_i · q_j) / r_{ij}²   （r_{ij} = min_{a∈i, b∈j} ||x_a − x_b||₂; q_R = q_K = +1.0, q_H = +0.1）',
    example:
      '• 最优示例：临床单抗 PPC 中位数为 0.19，最优区（25%–75% IQR）为 0.05–0.44（标为 D-GREEN）；\n• 高危示例（如 Bococizumab 类似物）：CDRH2 与 CDRL1 密集暴露多个 Arg/Lys（如 RKR 模体），导致 PPC = 1.45（> P95 = 0.99），触发 AMBER/RED 快清除警报。',
    benchmarkNote: 'OPIG TAP 2024 临床单抗基线（N = 1,121）：中位数 0.19，95% 分位阈值 0.99'
  },
  PNC: {
    label: 'TAP 2024 · Patches of Negative Charge (PNC · 单抗 Fv 负电荷斑块)',
    shortLabel: 'PNC (mAb)',
    unit: 'Score',
    summary:
      '量化传统单抗双链 Fv（VH+VL）在 CDR 邻域表面暴露的负电荷富集程度。过高的负电荷斑块（PNC 偏大）容易在组氨酸缓冲液（pH 5.5–6.5）中与分子其他正电区域形成长程静电偶极网络，导致高浓度皮下注射制剂（> 120 mg/mL）出现粘度激增（High Viscosity）、乳光（Opalescence）或液-液相分离。',
    method:
      '在双链 Fv 的 CDR 邻域表面暴露残基（PSA 侧链 RSA ≥ 7.5%）中，赋予 pH 7.4 下的负电荷权重（Asp = −1.0, Glu = −1.0），对所有最小重原子间距 r_ij < 7.5 Å 的负电残基对计算 (|q_i| · |q_j|) / r_ij² 并乘以 2。',
    formula:
      'PNC_Fv = 2 × ∑_{q_i < 0, q_j < 0, r_{ij} < 7.5Å} (|q_i| · |q_j|) / r_{ij}²   （r_{ij} = min_{a∈i, b∈j} ||x_a − x_b||₂; |q_D| = |q_E| = 1.0）',
    example:
      '• 最优示例：临床单抗 PNC 中位数为 0.22，最优区（25%–75% IQR）为 0.08–0.47（标为 D-GREEN）；\n• 高危示例：某抗体 CDRH3 与 CDRL2 含有连续暴露的 Asp/Glu（如 EDDY 模体），导致 PNC = 1.68（> P95 = 1.08），标为 AMBER/RED，提示高浓度制剂存在显著高粘度风险。',
    benchmarkNote: 'OPIG TAP 2024 临床单抗基线（N = 1,121）：中位数 0.22，95% 分位阈值 1.08'
  },
  TAP_PNC: {
    label: 'TAP 2024 · Patches of Negative Charge (PNC · 单抗 Fv 负电荷斑块)',
    shortLabel: 'PNC (mAb)',
    unit: 'Score',
    summary:
      '量化传统单抗双链 Fv（VH+VL）在 CDR 邻域表面暴露的负电荷富集程度。过高的负电荷斑块（PNC 偏大）容易在组氨酸缓冲液（pH 5.5–6.5）中与分子其他正电区域形成长程静电偶极网络，导致高浓度皮下注射制剂（> 120 mg/mL）出现粘度激增（High Viscosity）、乳光（Opalescence）或液-液相分离。',
    method:
      '在双链 Fv 的 CDR 邻域表面暴露残基（PSA 侧链 RSA ≥ 7.5%）中，赋予 pH 7.4 下的负电荷权重（Asp = −1.0, Glu = −1.0），对所有最小重原子间距 r_ij < 7.5 Å 的负电残基对计算 (|q_i| · |q_j|) / r_ij² 并乘以 2。',
    formula:
      'PNC_Fv = 2 × ∑_{q_i < 0, q_j < 0, r_{ij} < 7.5Å} (|q_i| · |q_j|) / r_{ij}²   （r_{ij} = min_{a∈i, b∈j} ||x_a − x_b||₂; |q_D| = |q_E| = 1.0）',
    example:
      '• 最优示例：临床单抗 PNC 中位数为 0.22，最优区（25%–75% IQR）为 0.08–0.47（标为 D-GREEN）；\n• 高危示例：某抗体 CDRH3 与 CDRL2 含有连续暴露的 Asp/Glu（如 EDDY 模体），导致 PNC = 1.68（> P95 = 1.08），标为 AMBER/RED，提示高浓度制剂存在显著高粘度风险。',
    benchmarkNote: 'OPIG TAP 2024 临床单抗基线（N = 1,121）：中位数 0.22，95% 分位阈值 1.08'
  },
  SFvCSP: {
    label: 'TAP 2024 · Structural Fv Charge Symmetry Parameter (SFvCSP · Fv 电荷对称性)',
    shortLabel: 'SFvCSP',
    unit: 'e²',
    summary:
      '传统单抗专属指标：衡量重链（VH）与轻链（VL）三维表面净电荷的对称性与分子间偶极吸引风险。当 VH 与 VL 带有相反符号的净表面电荷时（如 VH 带正电、VL 带负电，乘积 SFvCSP 为显著负值），不同抗体分子的 VH 与 VL 会发生强烈的“正负偶极交联吸引”，是引起高浓度单抗溶液粘度指数级上升的核心机制。',
    method:
      '分别统计 VH 链和 VL 链上所有表面暴露残基（PSA 侧链 RSA ≥ 7.5%）在 pH 7.4 下的净表面电荷 Q_surf(VH) 与 Q_surf(VL)，然后将两链净表面电荷直接相乘。',
    formula:
      'SFvCSP = Q_surf(VH) × Q_surf(VL)   （其中 Q_surf = ∑_{Exposed} [q(R,K=+1, H=+0.1, D,E=−1)]）',
    example:
      '• 理想同号排斥示例：Q_surf(VH) = +2.1 e，Q_surf(VL) = +1.5 e → SFvCSP = +3.15 e²（正值代表重轻链同带正电，分子间静电排斥，胶体稳定性好，标为 D-GREEN）；\n• 高危偶极吸引示例（如 Omalizumab 早期突变体）：Q_surf(VH) = +4.2 e，Q_surf(VL) = −3.5 e → SFvCSP = −14.7 e²（显著小于 P5 = −6.30 e²，触发 AMBER/RED 高粘度警报）。',
    benchmarkNote: 'OPIG TAP 2024 临床单抗基线（N = 1,121）：中位数 0.00 e²，最优区 −1.80 至 +2.90 e²'
  },
  TAP_SFvCSP: {
    label: 'TAP 2024 · Structural Fv Charge Symmetry Parameter (SFvCSP · Fv 电荷对称性)',
    shortLabel: 'SFvCSP',
    unit: 'e²',
    summary:
      '传统单抗专属指标：衡量重链（VH）与轻链（VL）三维表面净电荷的对称性与分子间偶极吸引风险。当 VH 与 VL 带有相反符号的净表面电荷时（如 VH 带正电、VL 带负电，乘积 SFvCSP 为显著负值），不同抗体分子的 VH 与 VL 会发生强烈的“正负偶极交联吸引”，是引起高浓度单抗溶液粘度指数级上升的核心机制。',
    method:
      '分别统计 VH 链和 VL 链上所有表面暴露残基（PSA 侧链 RSA ≥ 7.5%）在 pH 7.4 下的净表面电荷 Q_surf(VH) 与 Q_surf(VL)，然后将两链净表面电荷直接相乘。',
    formula:
      'SFvCSP = Q_surf(VH) × Q_surf(VL)   （其中 Q_surf = ∑_{Exposed} [q(R,K=+1, H=+0.1, D,E=−1)]）',
    example:
      '• 理想同号排斥示例：Q_surf(VH) = +2.1 e，Q_surf(VL) = +1.5 e → SFvCSP = +3.15 e²（正值代表重轻链同带正电，分子间静电排斥，胶体稳定性好，标为 D-GREEN）；\n• 高危偶极吸引示例（如 Omalizumab 早期突变体）：Q_surf(VH) = +4.2 e，Q_surf(VL) = −3.5 e → SFvCSP = −14.7 e²（显著小于 P5 = −6.30 e²，触发 AMBER/RED 高粘度警报）。',
    benchmarkNote: 'OPIG TAP 2024 临床单抗基线（N = 1,121）：中位数 0.00 e²，最优区 −1.80 至 +2.90 e²'
  },

  // ============================================================================
  // 2. 3D STRUCTURAL METRICS — TNP 2025 (Nanobody · VHH)
  // ============================================================================
  L: {
    label: 'TNP 2025 · VHH Total CDR Length (L · 纳米抗体 3 环总 CDR 长度)',
    shortLabel: 'L (VHH)',
    unit: 'AA',
    summary:
      '单域纳米抗体（VHH）全部 3 个 IMGT 高变环（CDR1、CDR2、CDR3）的氨基酸残基总长度。由于缺乏轻链（VL）配对，纳米抗体在进化中形成了比传统单抗重链 VH 更长的 CDR 环总长（通常 32–39 AA vs 传统 VH 的 26–31 AA），既能补偿抗原识别面积，又能借助长 CDR3 回折遮蔽原 VH:VL 界面（FR2）的疏水区。',
    method:
      '使用 ANARCI 对单域 VHH 序列执行 IMGT 编号，分别统计落在 IMGT 27–38（CDR1）、56–65（CDR2）和 105–117（CDR3）区间内的残基数并求和。按当前筛选的 TNP 临床纳米抗体参考库分位数进行 5 级色阶判定。',
    formula: 'L = len(CDR1: 27–38) + len(CDR2: 56–65) + len(CDR3: 105–117)',
    example:
      '• 最优示例（Caplacizumab 卡普赛珠单抗）：CDR1(8 AA) + CDR2(8 AA) + CDR3(19 AA) → L = 35 AA（落入临床 VHH 25%–75% 最优核心区 32–39 AA，标为 D-GREEN）；\n• 异常示例：若某 VHH 的 L = 23 AA（< P5），过短的 CDR 往往难以兼顾高亲和力与 FR2 疏水遮蔽。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 36 AA，最优区 32–39 AA'
  },
  TNP_L: {
    label: 'TNP 2025 · VHH Total CDR Length (L · 纳米抗体 3 环总 CDR 长度)',
    shortLabel: 'L (VHH)',
    unit: 'AA',
    summary:
      '单域纳米抗体（VHH）全部 3 个 IMGT 高变环（CDR1、CDR2、CDR3）的氨基酸残基总长度。由于缺乏轻链（VL）配对，纳米抗体在进化中形成了比传统单抗重链 VH 更长的 CDR 环总长（通常 32–39 AA vs 传统 VH 的 26–31 AA），既能补偿抗原识别面积，又能借助长 CDR3 回折遮蔽原 VH:VL 界面（FR2）的疏水区。',
    method:
      '使用 ANARCI 对单域 VHH 序列执行 IMGT 编号，分别统计落在 IMGT 27–38（CDR1）、56–65（CDR2）和 105–117（CDR3）区间内的残基数并求和。按当前筛选的 TNP 临床纳米抗体参考库分位数进行 5 级色阶判定。',
    formula: 'L = len(CDR1: 27–38) + len(CDR2: 56–65) + len(CDR3: 105–117)',
    example:
      '• 最优示例（Caplacizumab 卡普赛珠单抗）：CDR1(8 AA) + CDR2(8 AA) + CDR3(19 AA) → L = 35 AA（落入临床 VHH 25%–75% 最优核心区 32–39 AA，标为 D-GREEN）；\n• 异常示例：若某 VHH 的 L = 23 AA（< P5），过短的 CDR 往往难以兼顾高亲和力与 FR2 疏水遮蔽。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 36 AA，最优区 32–39 AA'
  },
  L3: {
    label: 'TNP 2025 · VHH CDR3 Loop Length (L3 · 纳米抗体 CDR3 环长度)',
    shortLabel: 'L3 (VHH)',
    unit: 'AA',
    summary:
      '纳米抗体（VHH）第三高变环（IMGT 105–117）的氨基酸残基长度。CDR3 占 VHH 抗原结合界面贡献的 60%–80%，是深入靶蛋白隐蔽裂隙（如 GPCR 活性口袋、离子通道或酶催化中心）以及回折覆盖 FR2 提升单域热稳定性的核心结构决定簇。',
    method:
      '基于 ANARCI IMGT 编号，直接统计 VHH 链落在 IMGT 105 至 117（含 111.1/111A、112.1/112A 等对称插入位点）区间内的残基总数。',
    formula: 'L3 = Count(Residues in IMGT 105–117)',
    example:
      '• 最优示例：临床 VHH 的 L3 中位数为 17 AA（最优 25%–75% IQR 为 13–19 AA，标为 D-GREEN）；\n• 边界示例：若 L3 ≥ 24 AA（> P95），长环构象熵显著升高，通常需要 CDR1（IMGT 38）与 CDR3 之间的非典型二硫键或强回折氢键网络（高 C 值）来固定构象。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 17 AA，最优区 13–19 AA'
  },
  TNP_L3: {
    label: 'TNP 2025 · VHH CDR3 Loop Length (L3 · 纳米抗体 CDR3 环长度)',
    shortLabel: 'L3 (VHH)',
    unit: 'AA',
    summary:
      '纳米抗体（VHH）第三高变环（IMGT 105–117）的氨基酸残基长度。CDR3 占 VHH 抗原结合界面贡献的 60%–80%，是深入靶蛋白隐蔽裂隙（如 GPCR 活性口袋、离子通道或酶催化中心）以及回折覆盖 FR2 提升单域热稳定性的核心结构决定簇。',
    method:
      '基于 ANARCI IMGT 编号，直接统计 VHH 链落在 IMGT 105 至 117（含 111.1/111A、112.1/112A 等对称插入位点）区间内的残基总数。',
    formula: 'L3 = Count(Residues in IMGT 105–117)',
    example:
      '• 最优示例：临床 VHH 的 L3 中位数为 17 AA（最优 25%–75% IQR 为 13–19 AA，标为 D-GREEN）；\n• 边界示例：若 L3 ≥ 24 AA（> P95），长环构象熵显著升高，通常需要 CDR1（IMGT 38）与 CDR3 之间的非典型二硫键或强回折氢键网络（高 C 值）来固定构象。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 17 AA，最优区 13–19 AA'
  },
  C: {
    label: 'TNP 2025 · CDR3 Compactness (C · 纳米抗体 CDR3 空间紧凑度)',
    shortLabel: 'C (VHH)',
    unit: 'AA / Å',
    summary:
      '纳米抗体专属 3D 构象指标：表征 CDR3 环在三维空间中的折叠紧凑程度与回折拓扑（Folded-back vs. Extended）。C 值越大，说明单位空间延展距离内容纳的 CDR3 残基越多，CDR3 呈紧密盘绕并向 FR2 表面回折贴合（有效遮蔽疏水侧链）；C 值越小，说明 CDR3 呈刚性 β-发夹向外笔直伸出。',
    method:
      '在 NanoBodyBuilder2 或晶体 3D 结构中（严格对应 TNP_2025_Batch.py）：\n(1) 提取 IMGT 105–117（CDR3）主链原子（N, Cα, C）的三维坐标，求其算术几何质心 Centroid_bb(CDR3)；\n(2) 提取 CDR3 根部骨架茎区 4 个锚点残基（IMGT 102, 103, 118, 119）主链原子（N, Cα, C）的几何质心 Centroid_bb(Anchors)；\n(3) 计算两质心间的三维欧氏距离 ρ（单位 Å）；\n(4) 用 CDR3 氨基酸长度 L3 除以 ρ 得到紧凑度 C。',
    formula: 'C = L3 / ρ,   其中 ρ = || Centroid_bb(IMGT 105–117) − Centroid_bb(IMGT 102,103,118,119) ||₂',
    example:
      '• 回折紧凑型示例：某驼源 VHH 的 L3 = 18 AA，CDR3 环回折贴合在 FR2 的 Phe42/Phe52 表面，质心距 ρ = 11.2 Å → C = 18 / 11.2 = 1.61 AA/Å（D-GREEN）；\n• 外伸手指型示例：某短环或外伸 VHH 的 L3 = 12 AA，向外笔直伸展 ρ = 11.5 Å → C = 12 / 11.5 = 1.04 AA/Å。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 1.42 AA/Å，最优区 1.15–1.62 AA/Å'
  },
  TNP_C: {
    label: 'TNP 2025 · CDR3 Compactness (C · 纳米抗体 CDR3 空间紧凑度)',
    shortLabel: 'C (VHH)',
    unit: 'AA / Å',
    summary:
      '纳米抗体专属 3D 构象指标：表征 CDR3 环在三维空间中的折叠紧凑程度与回折拓扑（Folded-back vs. Extended）。C 值越大，说明单位空间延展距离内容纳的 CDR3 残基越多，CDR3 呈紧密盘绕并向 FR2 表面回折贴合（有效遮蔽疏水侧链）；C 值越小，说明 CDR3 呈刚性 β-发夹向外笔直伸出。',
    method:
      '在 NanoBodyBuilder2 或晶体 3D 结构中（严格对应 TNP_2025_Batch.py）：\n(1) 提取 IMGT 105–117（CDR3）主链原子（N, Cα, C）的三维坐标，求其算术几何质心 Centroid_bb(CDR3)；\n(2) 提取 CDR3 根部骨架茎区 4 个锚点残基（IMGT 102, 103, 118, 119）主链原子（N, Cα, C）的几何质心 Centroid_bb(Anchors)；\n(3) 计算两质心间的三维欧氏距离 ρ（单位 Å）；\n(4) 用 CDR3 氨基酸长度 L3 除以 ρ 得到紧凑度 C。',
    formula: 'C = L3 / ρ,   其中 ρ = || Centroid_bb(IMGT 105–117) − Centroid_bb(IMGT 102,103,118,119) ||₂',
    example:
      '• 回折紧凑型示例：某驼源 VHH 的 L3 = 18 AA，CDR3 环回折贴合在 FR2 的 Phe42/Phe52 表面，质心距 ρ = 11.2 Å → C = 18 / 11.2 = 1.61 AA/Å（D-GREEN）；\n• 外伸手指型示例：某短环或外伸 VHH 的 L3 = 12 AA，向外笔直伸展 ρ = 11.5 Å → C = 12 / 11.5 = 1.04 AA/Å。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 1.42 AA/Å，最优区 1.15–1.62 AA/Å'
  },
  TNP_PSH: {
    label: 'TNP 2025 · VHH Surface Hydrophobicity (PSH · 纳米抗体单域表面疏水斑块)',
    shortLabel: 'PSH (VHH)',
    unit: 'Score',
    summary:
      '量化单域纳米抗体（VHH）三维结构中 CDR1–3 及其 4.0 Å 邻域（含暴露的 FR2 区域）的表面疏水斑块强度。与传统单抗不同，VHH 没有轻链（VL）遮挡 FR2 表面，因此若 FR2 保留了疏水残基（如人源化过度恢复为 V42/L50/W52）或长 CDR3 富含暴露的芳香族残基，会直接拉高 VHH 的 PSH 得分并引发单域热聚集。',
    method:
      '基于 OPIG TNP 2025 单域模型：\n(1) 在单域 VHH PDB 结构上调用 Joy PSA 计算各残基侧链 RSA（≥ 7.5% 判定为暴露）；\n(2) 确定 VHH CDR 邻域：包含 IMGT CDR+锚点区（IMGT 25–40、54–67、103–119），以及距离上述区域任意重原子 ≤ 4.0 Å 的暴露骨架残基（重点涵盖 FR2 IMGT 42, 49, 50, 52 邻近位点）；\n(3) 将 < 3.2 Å 分子内盐桥残基的疏水值重置为 Gly（H_Gly = 1.4545）；\n(4) 对所有最小重原子间距 r_ij < 7.5 Å 的暴露残基对计算归一化 Kyte-Doolittle 疏水积分。',
    formula:
      'PSH_VHH = 2 × ∑_{i < j, r_{ij} < 7.5Å} (H_i · H_j) / r_{ij}²   （r_{ij} = min_{a∈i, b∈j} ||x_a − x_b||₂; i, j ∈ Exposed VHH CDR+FR2 Vicinity）',
    example:
      '• 最优示例：临床纳米抗体（含亲水四联体 FERF/FERG）PSH 中位数为 126.4，最优区（25%–75% IQR）为 115.2–138.0（标为 D-GREEN）；\n• 高危示例：某人源化 VHH 将 FR2 突变为 VGLW 且 CDR3 未回折覆盖，导致 PSH = 162.5（> P95），触发 AMBER/RED 聚集警报。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 126.4，最优区 115.2–138.0'
  },
  TNP_PPC: {
    label: 'TNP 2025 · VHH Positive Charge Patches (PPC · 纳米抗体正电荷斑块)',
    shortLabel: 'PPC (VHH)',
    unit: 'Score',
    summary:
      '量化单域纳米抗体（VHH）在 CDR 邻域表面暴露的正电荷斑块强度。天然 VHH 常在 FR2 第 50 位携带保守的精氨酸（Arg50），若 CDR3 或 CDR2 同时富集过多暴露的 Arg/Lys，会形成强正电斑块，不仅增加非特异性组织粘附，还会加剧肾小管近端上皮细胞（Megalin/Cubilin 负电受体）的重吸收与肾脏滞留毒性。',
    method:
      '在单域 VHH 的 CDR 邻域暴露残基（PSA 侧链 RSA ≥ 7.5%）中，按 pH 7.4 电荷权重（Arg=+1.0, Lys=+1.0, His=+0.1）对所有最小重原子间距 r_ij < 7.5 Å 的正电残基对按距离平方反比求和。',
    formula:
      'PPC_VHH = 2 × ∑_{q_i > 0, q_j > 0, r_{ij} < 7.5Å} (q_i · q_j) / r_{ij}²   （r_{ij} = min_{a∈i, b∈j} ||x_a − x_b||₂; i, j ∈ Exposed VHH Vicinity）',
    example:
      '• 最优示例：临床 VHH 的 PPC 维持在 0.10–0.45（D-GREEN）；\n• 高危示例：若 CDR3 含连续 `RRK` 暴露序列导致 PPC = 1.35（> P95），则标为 AMBER/RED。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）'
  },
  TNP_PNC: {
    label: 'TNP 2025 · VHH Negative Charge Patches (PNC · 纳米抗体负电荷斑块)',
    shortLabel: 'PNC (VHH)',
    unit: 'Score',
    summary:
      '量化单域纳米抗体（VHH）在 CDR 邻域表面暴露的负电荷斑块强度。适度的表面负电有助于降低肾脏重吸收，但若 CDR 环上过度堆积 Asp/Glu 负电簇，可能通过与靶标表面负电区排斥而降低结合速率 $k_{\\text{on}}$，或在多价串联 VHH（如双抗/三抗）中引发结构域间静电偶极自聚。',
    method:
      '在单域 VHH 的 CDR 邻域暴露残基（PSA 侧链 RSA ≥ 7.5%）中，按 pH 7.4 负电荷权重（Asp=−1.0, Glu=−1.0）对所有最小重原子间距 r_ij < 7.5 Å 的负电残基对计算 (|q_i|·|q_j|) / r_ij² 并乘以 2。',
    formula:
      'PNC_VHH = 2 × ∑_{q_i < 0, q_j < 0, r_{ij} < 7.5Å} (|q_i| · |q_j|) / r_{ij}²   （r_{ij} = min_{a∈i, b∈j} ||x_a − x_b||₂; i, j ∈ Exposed VHH Vicinity）',
    example:
      '• 最优示例：临床 VHH 的 PNC 最优核心区（25%–75% IQR）约为 0.06–0.48（标为 D-GREEN）；\n• 预警示例：若 CDR2 与 CDR3 密集暴露多个 Asp/Glu 导致 PNC > 1.15，则触发 AMBER/RED 预警。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）'
  },
  Tetrad: {
    label: 'TNP 2025 · FR2 Hallmark Tetrad (VHH FR2 亲水特征四联体)',
    shortLabel: 'Tetrad',
    unit: 'IMGT 42,49,50,52',
    summary:
      '纳米抗体专属骨架标志：位于免疫球蛋白第二骨架区（FR2）IMGT 第 42、49、50、52 四个核心位点的氨基酸组合。传统单抗重链（VH）在此处高度保守为疏水的 `V-G-L-W` 四联体以介导与轻链（VL）的紧密结合；而天然驼源纳米抗体（VHH）在此处进化为亲水/带电残基（如 `F-E-R-F`、`F-E-R-G`、`Y-Q-R-L`），从而在无轻链条件下维持极高的单分散水溶性与热可逆折叠能力。',
    method:
      '从 ANARCI IMGT 编号映射中精确提取 IMGT 42、49、50、52 四个位点的氨基酸单字母代码拼接为 4 字符序列，并与临床 VHH 高频亲水四联体库比对。',
    formula: 'Tetrad = AA(IMGT 42) + AA(IMGT 49) + AA(IMGT 50) + AA(IMGT 52)',
    example:
      '• 典型驼源/人源化亲水四联体：`FERF`、`FERG`、`FEGF`、`YERL`、`YQRL`（Glu49 与 Arg50 可形成分子内增溶盐桥，Phe42/Phe52 协助固定回折的 CDR3，标为 GREEN）；\n• 风险四联体：`VGLW`（传统人源 VH 疏水四联体，若直接作为单域使用极易发生疏水聚集）。',
    benchmarkNote: 'IMGT 标准 FR2 标志位点：42, 49, 50, 52'
  },
  TAP: {
    label: 'TAP 2024 Overall Flag (单抗 3D 结构综合成药性评级)',
    shortLabel: 'TAP Overall',
    summary:
      '综合传统单抗全部 5 项 3D 结构指标（L_tot、PSH、PPC、PNC、SFvCSP）的最差风险等级（Worst-case Tier），一键标识候选单抗在三维表面斑块与环长层面的短板。',
    method:
      '遵循木桶原理（最差等级决定整体等级）：在当前激活的参考库筛选基线下，若 5 项 3D 指标中有任意一项落入 RED（<P0 或 >P100），则 TAP Overall 为 RED；否则若任意一项为 AMBER（P0–P5 或 P95–P100），则为 AMBER；依此类推至 L-GREEN、M-GREEN、D-GREEN。',
    formula: 'TAP_Overall = WorstTier(L_tot, PSH, PPC, PNC, SFvCSP)',
    example:
      '例如：某单抗 L_tot(D-GREEN)、PPC(D-GREEN)、PNC(M-GREEN)、SFvCSP(D-GREEN)，但 PSH 处于 97% 分位（AMBER），则 TAP Overall 标为 AMBER，提示工程改造只需聚焦降低 CDR 表面疏水性。'
  },
  TNP: {
    label: 'TNP 2025 Overall Flag (纳米抗体 3D 结构综合成药性评级)',
    shortLabel: 'TNP Overall',
    summary:
      '综合单域纳米抗体（VHH）全部 6 项 3D 结构指标（L、L3、C、PSH、PPC、PNC）的最差风险等级（Worst-case Tier）。',
    method:
      '在当前筛选的 TNP 临床纳米抗体参考库基线下，对 L、L3、C、PSH、PPC、PNC 逐项进行 5 级分位数判定，取风险最高的一级作为 TNP Overall 综合标签。',
    formula: 'TNP_Overall = WorstTier(L, L3, C, TNP_PSH, TNP_PPC, TNP_PNC)',
    example:
      '若候选纳米抗体的 6 项 3D 指标全部落入临床 VHH 的 25%–75% IQR 核心区，则 TNP Overall 标为最优 D-GREEN。'
  },

  // ============================================================================
  // 3. 1D PHYSICOCHEMICAL PROPERTIES — CHAIN-SPECIFIC (VHVL vs VH vs VL vs VHH)
  // ============================================================================

  // --- 3.1 Sequence Length ---
  VHVL_Length: {
    label: 'VH+VL (Whole Fv) · Combined Sequence Length (双链 Fv 总残基长度)',
    shortLabel: 'VHVL Length',
    unit: 'AA',
    summary:
      '单抗重链可变区（VH）与轻链可变区（VL）构成的完整抗原结合可变区复合物（Whole Fv Heterodimer）的氨基酸残基总数。反映整个 Fv 结构域的总体尺寸。',
    method:
      '分别统计去除空白符后的 VH 链氨基酸总数与 VL 链氨基酸总数并直接相加。按 TheraSAbDab 临床单抗 VH+VL 长度分位数进行 5 级判定。',
    formula: 'VHVL_Length = Length(VH) + Length(VL)',
    example:
      '• 典型示例（Trastuzumab）：VH (120 AA) + VL (107 AA) = 227 AA（处于临床单抗 Fv 最优区 224–231 AA，标为 D-GREEN）；\n• 极长示例：当 VH 含超长 CDRH3 且 VL 为长 CDRL1 的 κ2/λ 亚型时，VHVL_Length 可达 242 AA（> P95）。',
    benchmarkNote: 'TheraSAbDab 临床单抗 Fv 基线（N = 1,121）：中位数 227 AA，最优区 224–231 AA'
  },
  VH_Length: {
    label: 'VH Chain · Heavy Chain Variable Domain Length (重链可变区长度)',
    shortLabel: 'VH Length',
    unit: 'AA',
    summary:
      '单抗重链可变区单域（VH）的氨基酸残基总数。由于重链由 V-D-J 三个基因片段重排生成，其 CDRH3 长度跨度极大（5–30 AA），因此 VH_Length 的分布宽度显著大于轻链 VL。',
    method:
      '统计标准 IMGT VH 可变区（IMGT 1–128，从 FR1 首端至 FR4 J 区末端如 `WGQGTLVTVSS`）的氨基酸总数。',
    formula: 'VH_Length = Count(AA in VH domain, IMGT 1..128)',
    example:
      '临床单抗 VH 长度中位数为 119 AA（最优 25%–75% IQR 为 117–121 AA，标为 D-GREEN）。例如 IGHV3-23 胚系配对 13 AA 的 CDRH3 时，VH_Length = 120 AA。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VH 基线（N = 1,121）：中位数 119 AA，最优区 117–121 AA'
  },
  VL_Length: {
    label: 'VL Chain · Light Chain Variable Domain Length (轻链可变区长度)',
    shortLabel: 'VL Length',
    unit: 'AA',
    summary:
      '单抗轻链可变区单域（VL，含 κ 链或 λ 链）的氨基酸残基总数。轻链仅由 V-J 两个基因片段重排（无 D 片段），且 CDRL2 长度高度固定（通常仅 3 AA），因此 VL_Length 远比 VH 紧凑且集中在两个特征峰（短 CDRL1 的 IGKV1/IGKV3 约 107 AA，长 CDRL1 的 IGKV2/IGKV4/IGLV 约 111–113 AA）。',
    method:
      '统计标准 IMGT VL 可变区（IMGT 1–128，从 FR1 首端至 FR4 J 区末端如 `FGQGTKVEIK` 或 `FGGGTKLTVL`）的氨基酸总数。',
    formula: 'VL_Length = Count(AA in VL domain, IMGT 1..128)',
    example:
      '• IGKV1（如曲妥珠单抗 κ 链）：CDRL1 为 6 AA，VL_Length = 107 AA（临床最常见峰，标为 D-GREEN）；\n• IGKV2/IGKV4（含 11–12 AA 的长 CDRL1）：VL_Length = 112–113 AA。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VL 基线（N = 1,121）：中位数 108 AA，最优区 107–111 AA'
  },
  VHH_Length: {
    label: 'VHH Domain · Nanobody Sequence Length (纳米抗体单域序列长度)',
    shortLabel: 'VHH Length',
    unit: 'AA',
    summary:
      '单域纳米抗体（VHH）可变区的氨基酸残基总数。由于纳米抗体普遍具有更长的 CDR3 环（以及部分偶联长 CDR1），VHH 单域的平均长度通常比传统单抗的 VH 链长 3–6 个氨基酸。',
    method:
      '统计 VHH 单域（IMGT 1–128，从 FR1 至 FR4 `WGQGTQVTVSS`）的氨基酸残基总数。',
    formula: 'VHH_Length = Count(AA in VHH domain, IMGT 1..128)',
    example:
      '临床纳米抗体 VHH_Length 中位数约为 123 AA（最优 25%–75% IQR 为 119–126 AA，标为 D-GREEN）。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 123 AA'
  },

  // --- 3.2 Molecular Weight (MW) ---
  VHVL_Mol_Weight: {
    label: 'VH+VL (Whole Fv) · Heterodimer Molecular Weight (双链 Fv 联合分子量)',
    shortLabel: 'VHVL MW',
    unit: 'Da',
    summary:
      '单抗重链可变区（VH）与轻链可变区（VL）组成的完整 Fv 异源二聚体复合物的精确分子质量（单位 Da）。在生物物理计算中，双链 Fv 由两条独立的多肽链通过非共价作用组装而成，共拥有 2 个游离 N 端（-NH₂）与 2 个游离 C 端（-COOH）。',
    method:
      '分别计算 VH 单链分子量与 VL 单链分子量，然后将两者严格相加。绝不能将 VH 与 VL 序列直接拼接成一条长链计算——否则会错误地在 VH C 端与 VL N 端之间多扣除 1 个肽键缩合水分子（18.01528 Da）。',
    formula:
      'VHVL_MW = MW(VH) + MW(VL) = [∑ m_aa(VH) − (L_VH − 1)×18.015] + [∑ m_aa(VL) − (L_VL − 1)×18.015]',
    example:
      '例如：VH_MW = 13,240.5 Da，VL_MW = 11,580.3 Da → 双链复合物精确分子量 VHVL_MW = 24,820.8 Da（处于临床单抗 Fv 最优区 24,450–25,350 Da，标为 D-GREEN）。若错误拼接成单链则会少算 18.0 Da。',
    benchmarkNote: 'TheraSAbDab 临床单抗 Fv 基线（N = 1,121）：中位数 ~24,890 Da'
  },
  VH_Mol_Weight: {
    label: 'VH Chain · Heavy Chain Molecular Weight (重链可变区单链分子量)',
    shortLabel: 'VH MW',
    unit: 'Da',
    summary:
      '仅针对单抗重链可变区（VH 单链）计算的精确平均多肽分子质量（单位 Da）。用于评估重链可变区结构域自身的质量分布及质谱（LC-MS）亚基分子量核对。',
    method:
      '累加 VH 链全部氨基酸的平均同位素单体的质量，减去 (L_VH − 1) 个肽键脱水缩合失去的 H₂O 质量（18.01528 Da）。',
    formula: 'VH_MW = ∑_{i=1}^{L_VH} Mass(aa_i) − (L_VH − 1) × 18.01528 Da',
    example:
      '临床单抗 VH_MW 中位数约为 13,290 Da（最优 25%–75% IQR 约为 12,980–13,580 Da，标为 D-GREEN）。由于 VH 比 VL 多出约 10–12 个残基且 CDRH3 富含大分子量芳香族残基（Trp/Tyr），VH_MW 平均比 VL_MW 重约 1,680 Da。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VH 基线（N = 1,121）：中位数 ~13,290 Da'
  },
  VL_Mol_Weight: {
    label: 'VL Chain · Light Chain Molecular Weight (轻链可变区单链分子量)',
    shortLabel: 'VL MW',
    unit: 'Da',
    summary:
      '仅针对单抗轻链可变区（VL 单链，κ 或 λ）计算的精确平均多肽分子质量（单位 Da）。轻链可变区结构紧凑，且富含较小分子量的 Ser/Thr/Gly 残基，因此质量显著低于重链 VH。',
    method:
      '累加 VL 链全部氨基酸的平均质量，减去 (L_VL − 1) 个肽键脱水缩合失去的 H₂O 质量（18.01528 Da）。',
    formula: 'VL_MW = ∑_{i=1}^{L_VL} Mass(aa_i) − (L_VL − 1) × 18.01528 Da',
    example:
      '临床单抗 VL_MW 中位数约为 11,610 Da（最优 25%–75% IQR 约为 11,420–11,890 Da，标为 D-GREEN）。其中标准 107 AA 的 IGKV1 轻链可变区分子量通常在 11,500 Da 左右。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VL 基线（N = 1,121）：中位数 ~11,610 Da'
  },
  VHH_Mol_Weight: {
    label: 'VHH Domain · Nanobody Molecular Weight (纳米抗体单域分子量)',
    shortLabel: 'VHH MW',
    unit: 'Da',
    summary:
      '单域纳米抗体（VHH）的精确多肽分子质量（单位 Da）。纳米抗体是自然界最小的完整抗原结合功能单元（约 13–14 kDa，仅为传统 ~150 kDa 全长 IgG 的十分之一），这一超小分子量赋予其卓越的实体瘤组织穿透力，同时使其分子量远低于肾小球滤过截留阈值（~50–60 kDa）。',
    method:
      '累加 VHH 单域全部氨基酸的平均质量，减去 (L_VHH − 1) 个肽键脱水缩合的 H₂O 质量（18.01528 Da）。',
    formula: 'VHH_MW = ∑_{i=1}^{L_VHH} Mass(aa_i) − (L_VHH − 1) × 18.01528 Da',
    example:
      '临床纳米抗体 VHH_MW 中位数约为 13,420 Da（最优 25%–75% IQR 约为 12,950–13,850 Da，标为 D-GREEN）。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 ~13,420 Da'
  },

  // --- 3.3 Isoelectric Point (pI) ---
  VHVL_pI: {
    label: 'VH+VL (Whole Fv) · Two-Chain Coupled Isoelectric Point (双链 Fv 联合等电点)',
    shortLabel: 'VHVL pI',
    unit: 'pH',
    summary:
      '完整双链 Fv 异源二聚体复合物（VH+VL）净静电电荷恰好为 0 时的环境 pH 值。VHVL_pI 直接决定了全抗/Fab 在离子交换层析（IEX）中的洗脱盐浓度、制剂缓冲液 pH 选择（制剂 pH 应远离 VHVL_pI 至少 1.0–1.5 个单位以维持静电排斥），以及体内的组织分布与清除速率。',
    method:
      '采用**双链耦合 Henderson-Hasselbalch 方程二分法求根（基于 Biopython ProtParam / Bjellqvist et al. 标准 pKa 表）**：将 VH 与 VL 视为同一溶液体系中的两条独立多肽链（完整保留 2 个游离 N-端 α-NH₃⁺ [按首残基特异 pKa 6.82–8.36，默认 7.50]、2 个游离 C-端 α-COO⁻ [D=4.55, E=4.75，默认 3.55] 及两链所有可解离侧链 K=10.0, R=12.0, H=5.98, D=4.05, E=4.45, C=9.0, Y=10.0），在 pH ∈ [0, 14] 区间内执行 60 次二分法迭代，精确求解使双链总净电荷 Z_VH(pH) + Z_VL(pH) = 0 的根。\n⚠️ 科学严谨性说明：绝不能用 (VH_pI + VL_pI) / 2 简单算术平均近似 Fv 等电点！因为蛋白质滴定曲线在中性区是非线性的，当一条链缓冲容量大而另一条链缓冲容量小时，算术平均会产生高达 0.5–1.2 pH 单位的严重偏差。',
    formula:
      'Solve pH ∈ [0, 14] via 60-step bisection:   Z_VH(pH) + Z_VL(pH) = 0',
    example:
      '• 真实耦合求根示例：某单抗重链偏碱性 VH_pI = 8.95（含较多 Arg/Lys），轻链偏酸性 VL_pI = 5.65（但酸性链在 pH 7–8 区间斜率平坦、缓冲容量弱）。简单算术平均会误算为 7.30，而双链 Henderson-Hasselbalch 方程求得的真实等电点为 VHVL_pI = 8.24（落入临床单抗 Fv 最优区 7.85–8.85，标为 D-GREEN）。',
    benchmarkNote: 'TheraSAbDab 临床单抗 Fv 基线（N = 1,121）：中位数 pH 8.42，最优区 7.85–8.85'
  },
  VH_pI: {
    label: 'VH Chain · Heavy Chain Isoelectric Point (重链可变区单链等电点)',
    shortLabel: 'VH pI',
    unit: 'pH',
    summary:
      '仅针对单抗重链可变区（VH 单链）计算的理论等电点。人源及人源化抗体的重链胚系（如 IGHV1、IGHV3、IGHV4）在 FR3 区普遍含有多个保守的碱性残基（Arg/Lys），因此绝大多数临床单抗的 VH 单链呈明显碱性（中位数 pH ~8.62）。',
    method:
      '对独立 VH 链（含 1 个 N 端、1 个 C 端及 VH 内部所有 K/R/H/D/E/C/Y 侧链）应用 Henderson-Hasselbalch 方程，在 pH ∈ [0, 14] 区间二分法求解 Z_VH(pH) = 0。',
    formula: 'Solve pH ∈ [0, 14]:   Z_VH(pH) = q_Nterm(pH) − q_Cterm(pH) + ∑_{VH} q_side(pH) = 0',
    example:
      '• 最优示例：临床单抗 VH_pI 中位数为 8.62（最优 25%–75% IQR 为 7.92–9.05，标为 D-GREEN）；\n• 工程应用：若需延长抗体体内半衰期（增强内体 pH 6.0 下与 FcRn 解离后的胞外释放），常通过在 VH 的 CDR 环引入 Asp/Glu 将 VH_pI 从 9.2 下调至 7.8 左右。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VH 基线（N = 1,121）：中位数 pH 8.62，最优区 7.92–9.05'
  },
  VL_pI: {
    label: 'VL Chain · Light Chain Isoelectric Point (轻链可变区单链等电点)',
    shortLabel: 'VL pI',
    unit: 'pH',
    summary:
      '仅针对单抗轻链可变区（VL 单链）计算的理论等电点。与普遍偏碱性的重链 VH 不同，临床单抗的轻链 VL_pI 跨度极宽（pH 4.8–9.5，中位数 ~7.82），主要由轻链胚系家族决定：例如 IGKV1/IGKV4 和多数 IGLV（λ 链）常含有较多 Asp/Glu 呈中性或偏酸性（pI 5.2–6.9），而 IGKV3 家族则呈强碱性（pI 8.3–9.2）。',
    method:
      '对独立 VL 链（含 1 个 N 端、1 个 C 端及 VL 内部所有可解离侧链）应用 Henderson-Hasselbalch 方程，二分法求解 Z_VL(pH) = 0。',
    formula: 'Solve pH ∈ [0, 14]:   Z_VL(pH) = q_Nterm(pH) − q_Cterm(pH) + ∑_{VL} q_side(pH) = 0',
    example:
      '• 配对协同预警：若某抗体的 VL_pI 极低（如 pH 5.10，在生理 pH 7.4 下带强负电），而配对的 VH_pI 极高（如 pH 9.30，带强正电），虽然整体 VHVL_pI 可能居中，但会导致重轻链表面电荷严重反号（SFvCSP 强负值），引发高粘度风险！因此单独查看 VL_pI 与 VH_pI 的差值极具工程指导价值。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VL 基线（N = 1,121）：中位数 pH 7.82，最优区 6.25–8.75'
  },
  VHH_pI: {
    label: 'VHH Domain · Nanobody Isoelectric Point (纳米抗体单域等电点)',
    shortLabel: 'VHH pI',
    unit: 'pH',
    summary:
      '单域纳米抗体（VHH）净电荷为 0 时的环境 pH 值。由于单域 VHH 会被肾小球滤过进入原尿（pH ~6.0–6.8），若 VHH_pI 过高（> 9.0），纳米抗体在肾小管中带强正电，极易被肾近曲小管刷状缘带负电的 Megalin/Cubilin 系统高亲和力捕获，导致肾脏放射性/药物滞留。',
    method:
      '对单域 VHH（1 个 N 端、1 个 C 端及全部可解离侧链，含 FR2 特征位点 Glu49/Arg50）应用 Henderson-Hasselbalch 方程二分法求解 Z_VHH(pH) = 0。',
    formula: 'Solve pH ∈ [0, 14]:   Z_VHH(pH) = 0',
    example:
      '临床纳米抗体 VHH_pI 中位数约为 8.28（最优 25%–75% IQR 为 7.15–8.88，标为 D-GREEN）。在放射性核素偶联纳米抗体（RDC）研发中，常在 C 端或 FR 区保留适度酸性残基使 VHH_pI 控制在 6.5–7.8 以降低肾脏摄取。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 pH 8.28'
  },

  // --- 3.4 GRAVY Hydropathy ---
  VHVL_GRAVY: {
    label: 'VH+VL (Whole Fv) · Combined GRAVY Hydropathy (双链 Fv 加权亲疏水指数)',
    shortLabel: 'VHVL GRAVY',
    unit: 'KD',
    summary:
      '完整双链 Fv 复合物（VH+VL）在序列层面的总平均亲疏水性指数（Grand Average of Hydropathy，基于 Kyte-Doolittle 标度）。负值表示整体亲水（数值越负水溶性越好），正值表示整体偏疏水。',
    method:
      '为了消除 VH 与 VL 序列长度不同带来的偏差，双链 Fv 的 GRAVY 采用**残基长度精确加权平均**（等价于将 VH 与 VL 所有残基的 Kyte-Doolittle 分值相加后除以双链总残基数 L_VH + L_VL）。',
    formula:
      'VHVL_GRAVY = (L_VH · GRAVY_VH + L_VL · GRAVY_VL) / (L_VH + L_VL) = (∑_{VH+VL} KD_i) / (L_VH + L_VL)',
    example:
      '例如：VH (120 AA, GRAVY = −0.340) + VL (107 AA, GRAVY = −0.410) → VHVL_GRAVY = (120×(−0.340) + 107×(−0.410)) / 227 = −0.373（落入临床单抗 Fv 最优区 −0.43 至 −0.31，标为 D-GREEN）。',
    benchmarkNote: 'TheraSAbDab 临床单抗 Fv 基线（N = 1,121）：中位数 −0.37，最优区 −0.43 至 −0.31'
  },
  VH_GRAVY: {
    label: 'VH Chain · Heavy Chain GRAVY Hydropathy (重链可变区亲疏水指数)',
    shortLabel: 'VH GRAVY',
    unit: 'KD',
    summary:
      '仅针对单抗重链可变区（VH 单链）计算的 Kyte-Doolittle 平均亲疏水性指数。由于传统重链 VH 在 FR2 拥有疏水的轻链结合界面（V42, G49, L50, W52），且 CDRH3 常富含芳香族/疏水残基，因此 VH_GRAVY 天然比轻链 VL 偏高（即负得更少，疏水性略强）。',
    method:
      '将 VH 链内所有残基的 Kyte-Doolittle 亲疏水值（Ile=+4.5, Val=+4.2, Leu=+3.8, Phe=+2.8 ... Arg=−4.5）求和后除以 VH 长度 L_VH。',
    formula: 'VH_GRAVY = (1 / L_VH) × ∑_{i=1}^{L_VH} KD(aa_i)',
    example:
      '临床单抗 VH_GRAVY 中位数为 −0.35（最优 25%–75% IQR 为 −0.43 至 −0.27，标为 D-GREEN）。若某重链 VH_GRAVY > −0.10（> P95），提示重链单独表达或折叠时易发生疏水聚集。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VH 基线（N = 1,121）：中位数 −0.35，最优区 −0.43 至 −0.27'
  },
  VL_GRAVY: {
    label: 'VL Chain · Light Chain GRAVY Hydropathy (轻链可变区亲疏水指数)',
    shortLabel: 'VL GRAVY',
    unit: 'KD',
    summary:
      '仅针对单抗轻链可变区（VL 单链）计算的 Kyte-Doolittle 平均亲疏水性指数。人源 κ 和 λ 轻链骨架表面富含极性的丝氨酸（Ser, KD=−0.8）与苏氨酸（Thr, KD=−0.7），因此 VL_GRAVY 普遍比 VH 更负（亲水性更强），在双链组装中有助于提升整个 Fab 的水溶性。',
    method:
      '将 VL 链内所有残基的 Kyte-Doolittle 亲疏水值求和后除以 VL 长度 L_VL。',
    formula: 'VL_GRAVY = (1 / L_VL) × ∑_{i=1}^{L_VL} KD(aa_i)',
    example:
      '临床单抗 VL_GRAVY 中位数为 −0.40（最优 25%–75% IQR 为 −0.47 至 −0.33，标为 D-GREEN）。若轻链 CDRL1/L3 引入过多疏水残基导致 VL_GRAVY > −0.20，则丧失了轻链的增溶缓冲作用。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VL 基线（N = 1,121）：中位数 −0.40，最优区 −0.47 至 −0.33'
  },
  VHH_GRAVY: {
    label: 'VHH Domain · Nanobody GRAVY Hydropathy (纳米抗体单域亲疏水指数)',
    shortLabel: 'VHH GRAVY',
    unit: 'KD',
    summary:
      '单域纳米抗体（VHH）的 Kyte-Doolittle 平均亲疏水性指数。由于天然 VHH 将传统重链 FR2 的疏水四联体（VGLW）突变为亲水带电四联体（如 FERF / FERG / YQRL），VHH 单域的整体亲水性明显优于传统单抗重链 VH。',
    method:
      '将 VHH 单域所有残基的 Kyte-Doolittle 亲疏水值求和后除以 VHH 长度 L_VHH。',
    formula: 'VHH_GRAVY = (1 / L_VHH) × ∑_{i=1}^{L_VHH} KD(aa_i)',
    example:
      '临床纳米抗体 VHH_GRAVY 中位数约为 −0.39（最优 25%–75% IQR 为 −0.47 至 −0.29，标为 D-GREEN），比传统单抗 VH（−0.35）更亲水。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 −0.39'
  },

  // --- 3.5 Instability Index (II) ---
  VHVL_Instability: {
    label: 'VH+VL (Whole Fv) · Combined Instability Index (双链 Fv 加权不稳定指数)',
    shortLabel: 'VHVL Instability',
    unit: 'II',
    summary:
      '评估完整双链 Fv 复合物（VH+VL）在序列二肽组成层面的整体热力学与体内外抗降解稳定性（基于 Guruprasad 400 二肽不稳定权重矩阵）。数值越低代表二肽组成越稳定。',
    method:
      '分别独立计算 VH 链的 Guruprasad 不稳定指数 II_VH（仅扫描 VH 内部 L_VH − 1 个真实肽键）和 VL 链的 II_VL（仅扫描 VL 内部 L_VL − 1 个真实肽键），再按两链残基长度进行精确加权平均。\n⚠️ 科学严谨性说明：严禁将 VH 与 VL 字符串首尾直接拼接后调用单链算法！因为直接拼接会在 VH 的 C 端（如 Ser128）与 VL 的 N 端（如 Asp1/Glu1）之间凭空捏造一个物理上根本不存在的跨链伪二肽 `DIWV(VH_last, VL_first)`。',
    formula:
      'VHVL_II = (L_VH · II_VH + L_VL · II_VL) / (L_VH + L_VL)   （无跨链伪二肽误差）',
    example:
      '例如：VH (120 AA, II_VH = 36.5) + VL (107 AA, II_VL = 43.2) → 双链加权 VHVL_Instability = (120×36.5 + 107×43.2) / 227 = 39.66（落入临床单抗 Fv 最优区 37.8–45.2，标为 D-GREEN）。',
    benchmarkNote: 'TheraSAbDab 临床单抗 Fv 基线（N = 1,121）：中位数 41.3，最优区 37.8–45.2'
  },
  VH_Instability: {
    label: 'VH Chain · Heavy Chain Instability Index (重链可变区不稳定指数)',
    shortLabel: 'VH Instability',
    unit: 'II',
    summary:
      '仅针对单抗重链可变区（VH 单链）计算的 Guruprasad 二肽不稳定指数。重链胚系骨架（尤其是人源 IGHV3 家族）具有非常稳定的 β-桶二肽排列，因此临床单抗的 VH_Instability 绝大多数小于 40（中位数 ~39.2）。',
    method:
      '遍历 VH 链内所有相邻二肽 (aa_i, aa_{i+1})（共 L_VH − 1 对），查 Guruprasad 400×400 二肽不稳定权重表（DIWV）求和，乘以 (10 / L_VH)。',
    formula: 'VH_II = (10 / L_VH) × ∑_{i=1}^{L_VH - 1} DIWV(VH_i, VH_{i+1})',
    example:
      '临床单抗 VH_Instability 中位数为 39.2（最优 25%–75% IQR 为 34.8–43.9，标为 D-GREEN）。若在人源化回复突变或 CDR 嫁接后 VH_Instability > 50（> P95），提示重链可变区折叠稳定性受损。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VH 基线（N = 1,121）：中位数 39.2，最优区 34.8–43.9'
  },
  VL_Instability: {
    label: 'VL Chain · Light Chain Instability Index (轻链可变区不稳定指数)',
    shortLabel: 'VL Instability',
    unit: 'II',
    summary:
      '仅针对单抗轻链可变区（VL 单链）计算的 Guruprasad 二肽不稳定指数。\n💡 关键结构免疫学特征：人源 κ 和 λ 轻链胚系在 FR2（如 `WYQQKPGKAPK`）与 FR3（如 `GVPSRFSGSGS`）中含有多个在通用球蛋白统计中被赋予较高 DIWV 权重的保守二肽（如 `PS`、`SG`、`QQ`），因此**临床已获批单抗的 VL_Instability 天然高于 40（中位数为 43.8，最优 IQR 为 38.6–49.1）**！必须对照临床 VL 专属分位数基线评估，而不能机械套用通用蛋白“<40”的经验阈值。',
    method:
      '遍历 VL 链内所有相邻二肽 (aa_i, aa_{i+1})（共 L_VL − 1 对），查 Guruprasad DIWV 矩阵求和并乘以 (10 / L_VL)，随后对照 TheraSAbDab 临床 VL 专属分位数进行 5 级判定。',
    formula: 'VL_II = (10 / L_VL) × ∑_{i=1}^{L_VL - 1} DIWV(VL_i, VL_{i+1})',
    example:
      '例如：某采用人源 IGKV1-39 骨架的轻链 VL_Instability = 44.5——虽然数值大于 40，但在临床单抗 VL 分布中恰好处于 50% 中位数核心区（38.6–49.1），因此系统科学地将其判定为最优 **D-GREEN**；只有当 VL_Instability > 56.5（> P95）时才会标为 AMBER/RED。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VL 基线（N = 1,121）：中位数 43.8，最优区 38.6–49.1'
  },
  VHH_Instability: {
    label: 'VHH Domain · Nanobody Instability Index (纳米抗体单域不稳定指数)',
    shortLabel: 'VHH Instability',
    unit: 'II',
    summary:
      '单域纳米抗体（VHH）的 Guruprasad 二肽不稳定指数。天然驼源 VHH 经过进化筛选具备极高的热稳定性与化学变性可逆重折叠能力，其 VHH_Instability 平均低于传统单抗。',
    method:
      '遍历 VHH 单域内全部 L_VHH − 1 个相邻二肽，累加 DIWV 权重并乘以 (10 / L_VHH)。',
    formula: 'VHH_II = (10 / L_VHH) × ∑_{i=1}^{L_VHH - 1} DIWV(VHH_i, VHH_{i+1})',
    example:
      '临床纳米抗体 VHH_Instability 中位数约为 37.9（最优 25%–75% IQR 为 32.5–42.8，标为 D-GREEN）。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 37.9'
  },

  // --- 3.6 Net Charge at pH 7.4 ---
  'VHVL_Charge_pH7.4': {
    label: 'VH+VL (Whole Fv) · Combined Net Charge at pH 7.4 (双链 Fv 生理净电荷)',
    shortLabel: 'VHVL Charge',
    unit: 'e',
    summary:
      '完整双链 Fv 异源二聚体复合物（VH+VL）在人体血液生理环境（pH 7.40）下的总净静电电荷（单位：基本电荷 e）。根据电荷守恒定律，在固定 pH 下，双链复合物的总净电荷严格等于重链净电荷与轻链净电荷的代数和。适度的正净电荷（+0.5 ~ +3.5 e）有助于维持分子间胶体排斥，但过高正电（> +6.0 e）会加速体内非特异性清除。',
    method:
      '将 pH = 7.40 分别代入 VH 与 VL 的 Henderson-Hasselbalch 解离方程，计算两链正负离子基团电荷代数和并相加。',
    formula:
      'VHVL_Charge(7.4) = Z_VH(7.4) + Z_VL(7.4)',
    example:
      '例如：在 pH 7.4 下，VH_Charge = +1.65 e，VL_Charge = +0.55 e → 双链总净电荷 VHVL_Charge = +2.20 e（落入临床单抗 Fv 最优核心区 +0.85 至 +3.35 e，标为 D-GREEN）。',
    benchmarkNote: 'TheraSAbDab 临床单抗 Fv 基线（N = 1,121）：中位数 +2.10 e，最优区 +0.85 至 +3.35 e'
  },
  'VH_Charge_pH7.4': {
    label: 'VH Chain · Heavy Chain Net Charge at pH 7.4 (重链可变区生理净电荷)',
    shortLabel: 'VH Charge',
    unit: 'e',
    summary:
      '仅针对单抗重链可变区（VH 单链）在生理 pH 7.40 下计算的理论净静电电荷（单位 e）。临床单抗的 VH 链在 pH 7.4 下绝大多数带正电（中位数 +1.45 e），承担了 Fv 约 70% 的正电荷贡献。',
    method:
      '在 pH = 7.40 下（基于 Biopython ProtParam / Bjellqvist et al. 标准 pKa 表），累加 VH 链 1 个 N 端（首残基特异 pKa 6.82–8.36，默认 7.50）及所有 Lys(10.0)、Arg(12.0)、His(5.98) 的正电荷，减去 1 个 C 端（D=4.55, E=4.75，默认 3.55）及所有 Asp(4.05)、Glu(4.45)、Cys(9.0)、Tyr(10.0) 的负电荷。',
    formula:
      'VH_Charge(7.4) = ∑_{pos ∈ VH} 1/(1 + 10^{7.4 − pKa}) − ∑_{neg ∈ VH} 1/(1 + 10^{pKa − 7.4})',
    example:
      '临床单抗 VH_Charge 中位数为 +1.45 e（最优 25%–75% IQR 为 +0.40 至 +2.40 e，标为 D-GREEN）。若 VH_Charge > +4.5 e（> P95），提示重链 CDR 区正电荷过载。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VH 基线（N = 1,121）：中位数 +1.45 e，最优区 +0.40 至 +2.40 e'
  },
  'VL_Charge_pH7.4': {
    label: 'VL Chain · Light Chain Net Charge at pH 7.4 (轻链可变区生理净电荷)',
    shortLabel: 'VL Charge',
    unit: 'e',
    summary:
      '仅针对单抗轻链可变区（VL 单链）在生理 pH 7.40 下计算的理论净静电电荷（单位 e）。轻链在 pH 7.4 下的净电荷分布围绕中性偏微弱正电（中位数 +0.65 e），且约有 30% 的临床单抗轻链在 pH 7.4 下带负电（< 0 e）。',
    method:
      '在 pH = 7.40 下，累加 VL 链 1 个 N 端与碱性侧链的正电荷，减去 1 个 C 端与酸性侧链的负电荷。',
    formula:
      'VL_Charge(7.4) = ∑_{pos ∈ VL} 1/(1 + 10^{7.4 − pKa}) − ∑_{neg ∈ VL} 1/(1 + 10^{pKa − 7.4})',
    example:
      '临床单抗 VL_Charge 中位数为 +0.65 e（最优 25%–75% IQR 为 −0.60 至 +1.70 e，标为 D-GREEN）。当 VL_Charge 为显著负值（如 −2.8 e）且 VH_Charge 为显著正值（如 +3.5 e）时，需重点核查 3D 指标中的 SFvCSP 是否触发偶极吸引警报。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VL 基线（N = 1,121）：中位数 +0.65 e，最优区 −0.60 至 +1.70 e'
  },
  'VHH_Charge_pH7.4': {
    label: 'VHH Domain · Nanobody Net Charge at pH 7.4 (纳米抗体单域生理净电荷)',
    shortLabel: 'VHH Charge',
    unit: 'e',
    summary:
      '单域纳米抗体（VHH）在生理血液 pH 7.40 下的理论净静电电荷（单位 e）。由于 FR2 的 Glu49（−1）与 Arg50（+1）电荷相互抵消，VHH 的净电荷主要由 CDR1–3 环上的酸碱性残基决定。',
    method:
      '在 pH = 7.40 下基于 Henderson-Hasselbalch 方程计算单域 VHH 的正负解离基团电荷代数和。',
    formula:
      'VHH_Charge(7.4) = ∑_{pos ∈ VHH} 1/(1 + 10^{7.4 − pKa}) − ∑_{neg ∈ VHH} 1/(1 + 10^{pKa − 7.4})',
    example:
      '临床纳米抗体 VHH_Charge 中位数约为 +1.20 e（最优 25%–75% IQR 为 −0.20 至 +2.50 e，标为 D-GREEN）。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）：中位数 +1.20 e'
  },

  // --- 3.7 N-Glycosylation Sequon Count ---
  VHVL_N_Glyco_Count: {
    label: 'VH+VL (Whole Fv) · Combined N-Glycosylation Count (双链 Fv N-糖基化总位点数)',
    shortLabel: 'VHVL N-Glyc',
    unit: 'sites',
    summary:
      '完整双链 Fv 复合物（VH+VL）中检出的 N-连接糖基化三联体共有序列（N-X-S/T，其中 X ≠ P）的总个数（即重链与轻链检出数之和）。可变区（Fab）一旦发生 N-糖基化，会在哺乳动物细胞表达时引入高唾液酸化或非典型寡糖，造成严重的批次间电荷/分子量异质性（CMC 放行风险）或空间阻挡抗原结合。',
    method:
      '分别统计 VH 链与 VL 链匹配正则 `N[^P][ST]` 的位点数并求和。遵循 4-Tier 风险准则，可变区 N-糖基化属于 **Tier 1 Intolerable（不可接受级）**：只要 `VHVL_NGlyc > 0` 即判定为 **RED**，仅当 `== 0` 时为 **D-GREEN**。',
    formula:
      'VHVL_NGlyc = Count_VH(N[^P][ST]) + Count_VL(N[^P][ST]);   Flag: > 0 → RED, 0 → D-GREEN',
    example:
      '• 理想示例：`VHVL_NGlyc = 0`（93.2% 的临床单抗整个 Fv 无任何 N-糖基化基序，标为 D-GREEN）；\n• 风险示例（如 Cetuximab 西妥昔单抗）：VH 链 FR3 含有 1 个 `88@IMGT97(NDT)` 糖基化位点，导致 `VHVL_NGlyc = 1`，标为 RED。',
    benchmarkNote: 'TheraSAbDab 临床单抗 Fv 基线（N = 1,121）：93.2% 为 0 个位点'
  },
  VH_N_Glyco_Count: {
    label: 'VH Chain · Heavy Chain N-Glycosylation Count (重链可变区 N-糖基化位点数)',
    shortLabel: 'VH N-Glyc',
    unit: 'sites',
    summary:
      '仅针对单抗重链可变区（VH 单链）检出的 N-连接糖基化共有序列（`N[^P][ST]`）个数。在重链中，体细胞高频突变（SHM）最常在 **CDRH2（IMGT 56–65）**、**CDRH1（IMGT 27–38）** 或 **FR3 DE-loop（HV4 环，IMGT 81–85，如 IGHV4 家族的 `N72-T73-S74`）** 产生意外的 N-糖基化位点。',
    method:
      '在 VH 序列中扫描所有 `N[^P][ST]` 三联体。检出数 `> 0` 即标为 **Tier 1 RED**，`== 0` 标为 **D-GREEN**。',
    formula: 'VH_NGlyc = Count_VH(N[^P][ST]);   Flag: > 0 → RED, 0 → D-GREEN',
    example:
      '例如：某人源 IGHV4-34 衍生重链在 CDRH2 检出 `50@IMGT55(NHS)` 或在 FR3 DE-loop 检出 `72@IMGT81(NTS)[FR-Loop,Exp]`，`VH_NGlyc = 1`（RED），建议将 Asn 突变为 Gln/Ser 或将第 3 位 Ser/Thr 突变为 Ala。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VH 基线（N = 1,121）：95.1% 为 0 个位点'
  },
  VL_N_Glyco_Count: {
    label: 'VL Chain · Light Chain N-Glycosylation Count (轻链可变区 N-糖基化位点数)',
    shortLabel: 'VL N-Glyc',
    unit: 'sites',
    summary:
      '仅针对单抗轻链可变区（VL 单链）检出的 N-连接糖基化共有序列（`N[^P][ST]`）个数。在轻链中，意外的 N-糖基化位点最常出现在 **CDRL1（IMGT 27–38，尤其是含长环的 IGKV2 / IGKV4 家族如 `N28-X-S/T`）** 以及 **CDRL3（IMGT 105–117）**。',
    method:
      '在 VL 序列中扫描所有 `N[^P][ST]` 三联体。检出数 `> 0` 即标为 **Tier 1 RED**，`== 0` 标为 **D-GREEN**。',
    formula: 'VL_NGlyc = Count_VL(N[^P][ST]);   Flag: > 0 → RED, 0 → D-GREEN',
    example:
      '例如：某轻链在 CDRL1 检出 `28@IMGT29(NKS)[CDR-Loop,Exp]`，导致 `VL_NGlyc = 1`（标为 RED），在 CHO 细胞表达中会出现高比例轻链糖基化条带（SDS-PAGE 轻链上移 ~2–3 kDa）。',
    benchmarkNote: 'TheraSAbDab 临床单抗 VL 基线（N = 1,121）：97.9% 为 0 个位点'
  },
  VHH_N_Glyco_Count: {
    label: 'VHH Domain · Nanobody N-Glycosylation Count (纳米抗体单域 N-糖基化位点数)',
    shortLabel: 'VHH N-Glyc',
    unit: 'sites',
    summary:
      '单域纳米抗体（VHH）中检出的 N-连接糖基化共有序列（`N[^P][ST]`）个数。由于纳米抗体常采用毕赤酵母（*Pichia pastoris*）或 CHO 细胞生产，一旦含有 `N-X-S/T` 位点，在酵母中会发生严重的高甘露糖型过度糖基化（Hyper-mannosylation），引发强烈免疫原性与体内肝甘露糖受体快速清除。',
    method:
      '在 VHH 序列中扫描所有 `N[^P][ST]` 三联体。检出数 `> 0` 即标为 **Tier 1 RED**，`== 0` 标为 **D-GREEN**。',
    formula: 'VHH_NGlyc = Count_VHH(N[^P][ST]);   Flag: > 0 → RED, 0 → D-GREEN',
    example:
      '临床已获批纳米抗体（如 Caplacizumab、Ozoralizumab、Envafolimab）均经过严格去糖基化工程设计，`VHH_NGlyc = 0`（标为 D-GREEN）。',
    benchmarkNote: 'OPIG TNP 2025 临床纳米抗体基线（N = 39）'
  },

  // ============================================================================
  // 4. 4-TIER PTM SITES — CHAIN-SPECIFIC (VHVL vs VH vs VL vs VHH)
  // ============================================================================

  // --- 4.1 N-Glycosylation Sites ---
  VHVL_NGlycSites: {
    label: 'VH+VL (Whole Fv) · N-Glycosylation Sites (双链 Fv N-糖基化位点明细)',
    shortLabel: 'VHVL N-Glyc Sites',
    summary:
      '汇总双链 Fv（重链 VH + 轻链 VL）中所有检出的 N-糖基化三联体位点，并以 `VH:` 或 `VL:` 链前缀区分。所有可变区 N-糖基化位点均属于 **Tier 1 Intolerable（RED）**。',
    method:
      '合并 VH_NGlycSites 与 VL_NGlycSites，每个位点标注为 `Chain:linearPos@IMGTpos(Motif)[CDR-Loop/FR-Loop/FR-Strand,Exp/Buried]`。',
    formula: 'Format: VH:pos@IMGT(NxS/T)[Region,Exp], VL:pos@IMGT(NxS/T)[Region,Exp] → Tier 1 RED',
    example:
      '例如：`VH:55@IMGT62(NST)[CDR-Loop,Exp], VL:28@IMGT29(NYS)[CDR-Loop,Exp]`；若双链均无糖基化基序则显示 `None`（D-GREEN）。'
  },
  VH_NGlycSites: {
    label: 'VH Chain · Heavy Chain N-Glycosylation Sites (重链 N-糖基化位点明细)',
    shortLabel: 'VH N-Glyc Sites',
    summary:
      '列出重链可变区（VH）内检出的所有 `N[^P][ST]` 糖基化三联体精确坐标及 3D 结构暴露标签。属于 **Tier 1 Intolerable（RED）**。',
    method:
      '结合 ANARCI IMGT 编号与 Joy PSA 侧链 RSA（≥ 7.5% 为 Exp）生成 `linearPos@IMGTpos(Motif)[Region,Exp/Buried]`。',
    formula: 'Pattern: N[^P][ST] in VH → Tier 1 RED',
    example:
      '例如：`55@IMGT62(NST)[CDR-Loop,Exp]`（CDRH2 暴露糖基化位点）或 `74@IMGT82(NTS)[FR-Loop,Exp]`（FR3 DE-loop 暴露糖基化位点）。'
  },
  VL_NGlycSites: {
    label: 'VL Chain · Light Chain N-Glycosylation Sites (轻链 N-糖基化位点明细)',
    shortLabel: 'VL N-Glyc Sites',
    summary:
      '列出轻链可变区（VL）内检出的所有 `N[^P][ST]` 糖基化三联体精确坐标及 3D 结构暴露标签。属于 **Tier 1 Intolerable（RED）**。',
    method:
      '结合 ANARCI IMGT 编号与 Joy PSA 侧链 RSA（≥ 7.5% 为 Exp）生成 `linearPos@IMGTpos(Motif)[Region,Exp/Buried]`。',
    formula: 'Pattern: N[^P][ST] in VL → Tier 1 RED',
    example:
      '例如：`28@IMGT29(NKS)[CDR-Loop,Exp]`（CDRL1 暴露糖基化位点）；若无检出则显示 `None`（D-GREEN）。'
  },
  VHH_NGlycSites: {
    label: 'VHH Domain · Nanobody N-Glycosylation Sites (纳米抗体 N-糖基化位点明细)',
    shortLabel: 'VHH N-Glyc Sites',
    summary:
      '列出单域纳米抗体（VHH）内检出的所有 `N[^P][ST]` 糖基化三联体精确坐标及 3D 结构暴露标签。属于 **Tier 1 Intolerable（RED）**。',
    method:
      '结合 ANARCI IMGT 编号与 Joy PSA 侧链 RSA（≥ 7.5% 为 Exp）生成 `linearPos@IMGTpos(Motif)[Region,Exp/Buried]`。',
    formula: 'Pattern: N[^P][ST] in VHH → Tier 1 RED',
    example:
      '例如：`58@IMGT64(NDS)[CDR-Loop,Exp]`（CDR2 暴露糖基化位点）；若无检出则显示 `None`（D-GREEN）。'
  },

  // --- 4.2 Deamidation Sites ---
  VHVL_Deamidation: {
    label: 'VH+VL (Whole Fv) · Combined Asn Deamidation Sites (双链 Fv 脱酰胺位点汇总)',
    shortLabel: 'VHVL Deamidation',
    summary:
      '汇总双链 Fv（重链 `VH:` + 轻链 `VL:`）全部天冬酰胺（Asn, N）脱酰胺风险位点，并按双链最严重风险等级进行 4-Tier + Protected 着色。',
    method:
      '合并 VH 与 VL 的脱酰胺位点列表，对每个位点根据 3D Kabsch-Sander (DSSP) 二级结构（CDR-Loop / FR-Loop vs CDR-Strand / FR-Strand）与 PSA 侧链暴露度（RSA ≥ 7.5%）独立判定（默认仅评估 `[CDR-Loop,Exp]`，开启 `+ FR-Loop` 开关后同时包含 `[FR-Loop,Exp]`）：\n• Tier 2 High Risk (RED)：`NG` 位于暴露环区（`exposed & in loops`）；\n• Tier 3 Moderate Risk (AMBER)：`NS, NT, NN, NH` 位于暴露环区（`exposed & in loops`）；\n• Tier 4 Low Risk (L-GREEN)：其余 15 种 `Nx`（X ≠ G,S,T,N,H，包含 `NP`）位于暴露环区（`exposed & in loops`）；\n• Protected (D-GREEN)：位于 3D β-折叠股（`[CDR-Strand,*]` / `[FR-Strand,*]`）或内部包埋（`[*,Buried]`）的保守基序。',
    formula:
      'Cell Flag = WorstTier_{VH ∪ VL}(RED if NG∈LoopExp, AMBER if NS/NT/NN/NH∈LoopExp, L-GREEN if other Nx∈LoopExp, else D-GREEN)',
    example:
      '例如：`VH:54@IMGT59(NG)[CDR-Loop,Exp], VH:77@IMGT85(NT)[FR-Loop,Buried], VL:30@IMGT31(NY)[CDR-Loop,Exp]` → 其中 `VH:54(NG)` 标红，整格综合标为 **RED**。'
  },
  VH_Deamidation: {
    label: 'VH Chain · Heavy Chain Asn Deamidation Sites (重链脱酰胺位点 · 4-Tier)',
    shortLabel: 'VH Deamidation',
    summary:
      '评估重链可变区（VH）内天冬酰胺（Asn）的脱酰胺风险。在人源化及全人源重链中，最具代表性的三大脱酰胺区域为：\n1) **CDRH2 环区（IMGT 56–65）**：常含暴露的 `NG`（如 IMGT 59–62，高危 RED）或 `NS/NT`（中危 AMBER）；\n2) **FR3 DE-loop 转向环（HV4 环，IMGT 81–85）**：IGHV3 胚系在 IMGT 83–84（线性约 73–77 位）高度保守含有暴露的 `NS/NT`（标注为 `[FR-Loop,Exp]`，开启 `+ FR-Loop` 扩展模式时归为中危 AMBER，默认 `CDR-Loop Only` 模式下归为 Protected D-GREEN）；\n3) **FR3 Strand E（IMGT 90–94）**：如 `QMNSLRA` 中的 `NS`（IMGT 92–93）位于刚性 β-折叠股 `[FR-Strand,Buried]`，受二级结构氢键网络严密保护（Protected D-GREEN）。',
    method:
      '结合 ANARCI IMGT 区域（CDR: 27–38, 56–65, 105–117）、3D Kabsch-Sander (DSSP) 主链氢键二级结构（区分 Loop 与 β-Strand）与 PSA 侧链 RSA ≥ 7.5% 执行 4-Tier + Protected 判定。',
    formula:
      'High (RED): NG ∈ [*-Loop,Exp] · Mod (AMBER): {NS,NT,NN,NH} ∈ [*-Loop,Exp] · Low (L-GREEN): other 15 Nx ∈ [*-Loop,Exp] · Protected (D-GREEN): *-Strand / Buried',
    example:
      '• 高危 RED：`54@IMGT59(NG)[CDR-Loop,Exp]`（CDRH2 暴露快脱酰胺位点）；\n• 中危 AMBER：`56@IMGT61(NS)[CDR-Loop,Exp]`（CDRH2 暴露环位点）；\n• 低危 L-GREEN：`31@IMGT32(NY)[CDR-Loop,Exp]`（CDRH1 暴露普通 Nx）；\n• 保护态 D-GREEN：`84@IMGT92(NS)[FR-Strand,Buried]`（FR3 折叠股包埋位点）。'
  },
  VL_Deamidation: {
    label: 'VL Chain · Light Chain Asn Deamidation Sites (轻链脱酰胺位点 · 4-Tier)',
    shortLabel: 'VL Deamidation',
    summary:
      '评估轻链可变区（VL，κ 或 λ）内天冬酰胺（Asn）的脱酰胺风险。在轻链中，最关键的脱酰胺热点集中在 **CDRL1（IMGT 27–38，尤其是长环 IGKV2 如 `RSSQSLLHSNGYNYLD` 中的暴露 `NG`）** 和 **CDRL3（IMGT 105–117，如 `QQYNSYPWT` 中的暴露 `NS`）**。',
    method:
      '结合轻链 IMGT 区域、3D DSSP 环区/折叠股边界与 PSA 侧链 RSA ≥ 7.5% 执行 4-Tier + Protected 判定。',
    formula:
      'High (RED): NG ∈ [*-Loop,Exp] · Mod (AMBER): {NS,NT,NN,NH} ∈ [*-Loop,Exp] · Low (L-GREEN): other 15 Nx ∈ [*-Loop,Exp] · Protected (D-GREEN): *-Strand / Buried',
    example:
      '• 高危 RED：`33@IMGT34(NG)[CDR-Loop,Exp]`（IGKV2 轻链 CDRL1 典型快脱酰胺热点）；\n• 中危 AMBER：`92@IMGT108(NS)[CDR-Loop,Exp]`（CDRL3 暴露环 `NS` 位点）。'
  },
  VHH_Deamidation: {
    label: 'VHH Domain · Nanobody Asn Deamidation Sites (纳米抗体脱酰胺位点 · 4-Tier)',
    shortLabel: 'VHH Deamidation',
    summary:
      '评估单域纳米抗体（VHH）内天冬酰胺（Asn）的脱酰胺风险。由于纳米抗体常在高温或苛刻条件下使用，且长 CDR3 与 CDR2 高度暴露于溶剂，消除 CDR 环上的 `NG`（Tier 2 RED）与 `NS/NT/NN/NH`（Tier 3 AMBER）对维持长期储存活性至关重要。',
    method:
      '基于 VHH IMGT 区域、3D DSSP 环区边界与 PSA 侧链 RSA ≥ 7.5% 执行 4-Tier + Protected 判定。',
    formula:
      'High (RED): NG ∈ [*-Loop,Exp] · Mod (AMBER): {NS,NT,NN,NH} ∈ [*-Loop,Exp] · Low (L-GREEN): other 15 Nx ∈ [*-Loop,Exp] · Protected (D-GREEN): *-Strand / Buried',
    example:
      '例如：`56@IMGT62(NG)[CDR-Loop,Exp]` 标为 Tier 2 RED；`58@IMGT64(NT)[CDR-Loop,Exp]` 标为 Tier 3 AMBER。'
  },

  // --- 4.3 Isomerization Sites ---
  VHVL_Isomerization: {
    label: 'VH+VL (Whole Fv) · Combined Asp Isomerization Sites (双链 Fv 异构化位点汇总)',
    shortLabel: 'VHVL Isomerization',
    summary:
      '汇总双链 Fv（`VH:` + `VL:`）全部天冬氨酸（Asp, D）异构化生成 isoAsp 的风险位点，并按双链最严重风险等级进行 4-Tier + Protected 着色。',
    method:
      '合并 VH 与 VL 的异构化位点列表（默认仅评估 `[CDR-Loop,Exp]`，开启 `+ FR-Loop` 开关后同时包含 `[FR-Loop,Exp]`）：\n• Tier 2 High Risk (RED)：`DG` 位于暴露环区（`exposed & in loops`）；\n• Tier 3 Moderate Risk (AMBER)：`DS, DD` 位于暴露环区（`exposed & in loops`）；\n• Tier 4 Low Risk (L-GREEN)：其余 17 种 `Dx`（X ≠ G,S,D，包含 `DP, DT, DH` 等）位于暴露环区（`exposed & in loops`）；\n• Protected (D-GREEN)：位于 3D β-折叠股（`[CDR-Strand,*]` / `[FR-Strand,*]`）或内部包埋（`[*,Buried]`）的保守位点（如双链各自高度保守的内部盐桥 `IMGT D98`）。',
    formula:
      'Cell Flag = WorstTier_{VH ∪ VL}(RED if DG∈LoopExp, AMBER if DS/DD∈LoopExp, L-GREEN if other Dx∈LoopExp, else D-GREEN)',
    example:
      '例如：若某抗体仅检出 `VH:89@IMGT98(DT)[FR-Strand,Buried], VL:82@IMGT98(DF)[FR-Strand,Buried]`（均为保守包埋盐桥位点），则单元格整体判定为最优 **D-GREEN**！'
  },
  VH_Isomerization: {
    label: 'VH Chain · Heavy Chain Asp Isomerization Sites (重链异构化位点 · 4-Tier)',
    shortLabel: 'VH Isomerization',
    summary:
      '评估重链可变区（VH）内天冬氨酸（Asp, D）异构化为 isoAsp 的风险。重链中最关键的异构化高发区是 **CDRH3（IMGT 105–117，因 D 基因片段及 J 区末端 `FDY/MDV` 常富含 Asp）** 与 **CDRH2（IMGT 56–65，常见 `DG/DS`）**；而位于 FR3 Strand F 起始端的 **`IMGT Asp98`（线性约 88–90 位，序列 `...EDTAVYYC...`）** 是形成内部保守盐桥的刚性包埋残基，系统精确将其归为 `[FR-Strand,Buried]`（Protected D-GREEN）。',
    method:
      '结合重链 IMGT 区域、3D DSSP 环区/折叠股边界与 PSA 侧链 RSA ≥ 7.5% 执行 4-Tier + Protected 判定。',
    formula:
      'High (RED): DG ∈ [*-Loop,Exp] · Mod (AMBER): {DS,DD} ∈ [*-Loop,Exp] · Low (L-GREEN): other 17 Dx ∈ [*-Loop,Exp] · Protected (D-GREEN): *-Strand / Buried',
    example:
      '• 高危 RED：`99@IMGT108(DG)[CDR-Loop,Exp]`（如曲妥珠单抗 CDRH3 著名的暴露异构化敏感位点 Asp99-Gly100）；\n• 中危 AMBER：`55@IMGT61(DS)[CDR-Loop,Exp]`（CDRH2 暴露环 DS）；\n• 低危 L-GREEN：`101@IMGT110(DP)[CDR-Loop,Exp]`（CDRH3 暴露环其他 Dx 位点）；\n• 保护态 D-GREEN：`89@IMGT98(DT)[FR-Strand,Buried]`（FR3 保守内部盐桥 Asp98）。'
  },
  VL_Isomerization: {
    label: 'VL Chain · Light Chain Asp Isomerization Sites (轻链异构化位点 · 4-Tier)',
    shortLabel: 'VL Isomerization',
    summary:
      '评估轻链可变区（VL）内天冬氨酸（Asp, D）的异构化风险。在轻链中，暴露环区异构化主要出现在 **CDRL1（IMGT 27–38）**、**CDRL2（IMGT 56–65，如 `DAS/DDS`）** 和 **CDRL3**；而位于 FR3 Strand F 的 **`IMGT Asp98`（线性约 81–83 位，序列 `...EDFATYYC...`）** 同样为保守包埋盐桥位点（Protected D-GREEN）。',
    method:
      '结合轻链 IMGT 区域、3D DSSP 环区/折叠股边界与 PSA 侧链 RSA ≥ 7.5% 执行 4-Tier + Protected 判定。',
    formula:
      'High (RED): DG ∈ [*-Loop,Exp] · Mod (AMBER): {DS,DD} ∈ [*-Loop,Exp] · Low (L-GREEN): other 17 Dx ∈ [*-Loop,Exp] · Protected (D-GREEN): *-Strand / Buried',
    example:
      '• 高危 RED：`30@IMGT31(DG)[CDR-Loop,Exp]`（CDRL1 暴露快异构化位点）；\n• 保护态 D-GREEN：`82@IMGT98(DF)[FR-Strand,Buried]`（轻链 FR3 保守盐桥 Asp98）。'
  },
  VHH_Isomerization: {
    label: 'VHH Domain · Nanobody Asp Isomerization Sites (纳米抗体异构化位点 · 4-Tier)',
    shortLabel: 'VHH Isomerization',
    summary:
      '评估单域纳米抗体（VHH）内天冬氨酸（Asp, D）的异构化风险。VHH 的长 CDR3 环常含有多个天冬氨酸用于与靶标形成盐桥或氢键，若在暴露环区构成 `DG`（Tier 2 RED）或 `DS/DD`（Tier 3 AMBER），在弱酸性制剂中易发生异构化导致亲和力下降。',
    method:
      '基于 VHH IMGT 区域、3D DSSP 环区/折叠股边界与 PSA 侧链 RSA ≥ 7.5% 执行 4-Tier + Protected 判定。',
    formula:
      'High (RED): DG ∈ [*-Loop,Exp] · Mod (AMBER): {DS,DD} ∈ [*-Loop,Exp] · Low (L-GREEN): other 17 Dx ∈ [*-Loop,Exp] · Protected (D-GREEN): *-Strand / Buried',
    example:
      '例如：`105@IMGT111(DG)[CDR-Loop,Exp]` 标为 Tier 2 RED；`90@IMGT98(DT)[FR-Strand,Buried]` 标为 Protected（D-GREEN）。'
  },

  // --- 4.4 Legacy Cleavage Alias (Unified into Isomerization Tier 4 Low Risk) ---
  VHVL_Cleavage: {
    label: 'VH+VL (Whole Fv) · Asp-Pro (DP) Sites (已统一归入 Isomerization · Tier 4 Low Risk)',
    shortLabel: 'VHVL DP Sites',
    summary:
      '按照 4-Tier 黄金标准风险体系，`DP` 已统一并入 `Isomerization`（归为 Tier 4 Low Risk `Nx Dx not mentioned above; exposed & in loops`）。',
    method:
      '位于暴露环区（`[CDR-Loop,Exp]` 或开启扩展开关后的 `[FR-Loop,Exp]`）的 `DP` 判定为 **Tier 4 Low Risk (L-GREEN)**；位于刚性折叠股或内部包埋的 `DP` 判定为 **Protected (D-GREEN)**。',
    formula: 'Low (L-GREEN): DP ∈ [*-Loop,Exp] · Protected (D-GREEN): DP ∈ [*-Strand,*] / [*,Buried]',
    example:
      '例如：`VH:101@IMGT110(DP)[CDR-Loop,Exp]` 标为 L-GREEN。'
  },
  VH_Cleavage: {
    label: 'VH Chain · Heavy Chain Asp-Pro (DP) Sites (已统一归入 Isomerization · Tier 4 Low Risk)',
    shortLabel: 'VH DP Sites',
    summary:
      '按照 4-Tier 黄金标准风险体系，重链 `DP` 已统一并入 `VH_Isomerization` 的 `Other Dx`（Tier 4 Low Risk）。',
    method:
      '若位于暴露环区则标为 **L-GREEN**；若位于折叠股或包埋则为 **Protected (D-GREEN)**。',
    formula: 'Low (L-GREEN): DP ∈ [*-Loop,Exp] in VH',
    example:
      '例如：`98@IMGT107(DP)[CDR-Loop,Exp]`（CDRH3 暴露环 DP 位点，标为 L-GREEN）。'
  },
  VL_Cleavage: {
    label: 'VL Chain · Light Chain Asp-Pro (DP) Sites (已统一归入 Isomerization · Tier 4 Low Risk)',
    shortLabel: 'VL DP Sites',
    summary:
      '按照 4-Tier 黄金标准风险体系，轻链 `DP` 已统一并入 `VL_Isomerization` 的 `Other Dx`（Tier 4 Low Risk）。',
    method:
      '若位于暴露环区则标为 **L-GREEN**；若位于折叠股或包埋则为 **Protected (D-GREEN)**。',
    formula: 'Low (L-GREEN): DP ∈ [*-Loop,Exp] in VL',
    example:
      '绝大多数临床轻链不含暴露环 DP 基序，标为最优 D-GREEN。'
  },
  VHH_Cleavage: {
    label: 'VHH Domain · Nanobody Asp-Pro (DP) Sites (已统一归入 Isomerization · Tier 4 Low Risk)',
    shortLabel: 'VHH DP Sites',
    summary:
      '按照 4-Tier 黄金标准风险体系，纳米抗体 `DP` 已统一并入 `VHH_Isomerization` 的 `Other Dx`（Tier 4 Low Risk）。',
    method:
      '若位于暴露环区则标为 **L-GREEN**；否则为 **Protected (D-GREEN)**。',
    formula: 'Low (L-GREEN): DP ∈ [*-Loop,Exp] in VHH',
    example:
      '例如：`103@IMGT111(DP)[CDR-Loop,Exp]`（CDR3 暴露环 DP 位点，标为 L-GREEN）。'
  },

  // --- 4.5 Oxidation Sites (M / W) ---
  VHVL_Oxidation: {
    label: 'VH+VL (Whole Fv) · Combined Met/Trp Oxidation Sites (双链 Fv 氧化位点汇总)',
    shortLabel: 'VHVL Oxidation',
    summary:
      '汇总双链 Fv（`VH:` + `VL:`）全部甲硫氨酸（M）与色氨酸（W）位点，并严格遵循黄金标准 4-Tier 规则区分**暴露环区**风险位点（`M, W; exposed & in loops` → Tier 3 AMBER）与 β-折叠股/核心包埋保护位点（Protected D-GREEN）。',
    method:
      '合并 VH 与 VL 的 M/W 位点（默认仅评估 `[CDR-Loop,Exp]`，开启 `+ FR-Loop` 开关后同时包含 `[FR-Loop,Exp]`）：\n• Tier 3 Moderate Risk (AMBER)：位于暴露柔性环区的 M 或 W（`M[CDR-Loop,Exp]` / `W[CDR-Loop,Exp]`，开启扩展开关后包含 `M[FR-Loop,Exp]` / `W[FR-Loop,Exp]`）；\n• Protected 结构保护态 (D-GREEN)：内部包埋或位于刚性 β-折叠股（`[CDR-Strand,*]` / `[FR-Strand,*]`）的 M 与 W（如 `IMGT M39, M91, W41, W52, W118`）。',
    formula:
      'Cell Flag = AMBER if (∃ M∈[*-Loop,Exp] ∨ ∃ W∈[*-Loop,Exp]) in VH∪VL, else D-GREEN',
    example:
      '例如：某单抗仅含保守骨架位点 `VH:36@IMGT41(W)[FR-Strand,Buried], VH:109@IMGT118(W)[FR-Strand,Buried], VL:35@IMGT41(W)[FR-Strand,Buried]`，因全部为 `[FR-Strand,Buried]`，单元格整体标为最优 **D-GREEN**！'
  },
  VH_Oxidation: {
    label: 'VH Chain · Heavy Chain Met/Trp Oxidation Sites (重链氧化位点 · 4-Tier)',
    shortLabel: 'VH Oxidation',
    summary:
      '评估重链可变区（VH）内甲硫氨酸（M）与色氨酸（W）的氧化风险。重链具有多个极具特征的结构位点：\n1) **保守包埋/折叠股保护位点（Protected D-GREEN）**：`IMGT W41`（FR2 折叠核心锚点，100% 保守）、`IMGT W52`（FR2 重轻链界面）、`IMGT W118`（FR4 J 区 `WGQGT` 起始锚点）、`IMGT M39`（CDR1 尾端包埋锚点）及 `IMGT M91`（FR3 疏水核心）；\n2) **活跃氧化风险位点（Tier 3 AMBER）**：位于暴露环区（`exposed & in loops`）的甲硫氨酸 `M[*-Loop,Exp]` 与色氨酸 `W[*-Loop,Exp]`。',
    method:
      '对 VH 中所有 M 与 W 结合 IMGT 坐标、3D DSSP 环区/折叠股二级结构与 PSA 侧链 RSA ≥ 7.5% 判定：暴露环区的 M 或 W 标为 **AMBER**；包埋或 β-折叠股的 M 与 W 标为 **Protected (D-GREEN)**。',
    formula:
      'Mod (AMBER): {M, W} ∈ [*-Loop,Exp] · Protected (D-GREEN): W41, W52, W118, M39, M91 (Buried / *-Strand)',
    example:
      '• 风险示例：`100@IMGT109(W)[CDR-Loop,Exp]` 或 `98@IMGT107(M)[CDR-Loop,Exp]`（CDRH3 暴露环 M/W，标为 AMBER）；\n• 保护态示例：`36@IMGT41(W)[FR-Strand,Buried], 34@IMGT39(M)[CDR-Strand,Buried], 82@IMGT91(M)[FR-Strand,Buried], 111@IMGT118(W)[FR-Strand,Buried]`（全部为保守包埋核心/折叠股，整体标为 D-GREEN）。'
  },
  VL_Oxidation: {
    label: 'VL Chain · Light Chain Met/Trp Oxidation Sites (轻链氧化位点 · 4-Tier)',
    shortLabel: 'VL Oxidation',
    summary:
      '评估轻链可变区（VL）内甲硫氨酸（M）与色氨酸（W）的氧化风险。轻链在 FR2 同样拥有 100% 保守的内部疏水核心锚点 **`IMGT W41`（线性约 35 位，序列 `...WYQQKP...`，恒为 `[FR-Strand,Buried]`）**；而风险位点主要来自 **CDRL3（IMGT 105–117，如 `QQYNSYPWT` 中的暴露环 `W`）** 或 **CDRL1 暴露环中的 `M/W`**。',
    method:
      '对 VL 中所有 M 与 W 结合 IMGT 坐标、3D DSSP 环区/折叠股与 PSA 侧链 RSA ≥ 7.5% 判定：暴露环区的 M 或 W 标为 **AMBER**；包埋或 β-折叠股的 M 与 W（如 W41）标为 **Protected (D-GREEN)**。',
    formula:
      'Mod (AMBER): {M, W} ∈ [*-Loop,Exp] · Protected (D-GREEN): VL IMGT W41 [FR-Strand,Buried]',
    example:
      '• 风险示例：`94@IMGT114(W)[CDR-Loop,Exp]`（CDRL3 暴露环色氨酸，标为 AMBER）；\n• 保护态示例：`35@IMGT41(W)[FR-Strand,Buried]`（轻链唯一保守色氨酸 W41，单元格整体标为最优 D-GREEN）。'
  },
  VHH_Oxidation: {
    label: 'VHH Domain · Nanobody Met/Trp Oxidation Sites (纳米抗体氧化位点 · 4-Tier)',
    shortLabel: 'VHH Oxidation',
    summary:
      '评估单域纳米抗体（VHH）内甲硫氨酸（M）与色氨酸（W）的氧化风险。纳米抗体同样保留了 `IMGT W41` 与 `IMGT W118` 两个核心折叠股色氨酸（但第 52 位通常已突变为亲水四联体的 Phe/Gly/Leu）；其长 CDR3 环若含有暴露环区的 M 或 W（`exposed & in loops`），则需关注氧化修饰对靶标结合的影响。',
    method:
      '对 VHH 中所有 M 与 W 结合 IMGT 坐标、3D DSSP 环区/折叠股与 PSA 侧链 RSA ≥ 7.5% 判定：暴露环区的 M 或 W 标为 **AMBER**；包埋或 β-折叠股位点标为 **Protected (D-GREEN)**。',
    formula:
      'Mod (AMBER): {M, W} ∈ [*-Loop,Exp] in VHH',
    example:
      '例如：`106@IMGT112(W)[CDR-Loop,Exp]` 标为 AMBER；而 `36@IMGT41(W)[FR-Strand,Buried], 115@IMGT118(W)[FR-Strand,Buried]` 为保护态（D-GREEN）。'
  },

  // --- 4.6 Cysteine & 3D Disulfide Pairing Status ---
  VHVL_Cys: {
    label: 'VH+VL (Whole Fv) · Combined Cysteine & Free Thiol Status (双链 Fv 半胱氨酸配对状态)',
    shortLabel: 'VHVL Cys',
    summary:
      '汇总双链 Fv（重链 VH + 轻链 VL）的半胱氨酸（Cys, C）总数及游离巯基（Free Cys）状态。标准单抗 Fv 共含有 4 个保守 Cys（VH 与 VL 各一对 `IMGT Cys23–Cys104` 链内二硫键）；工程化 ds-scFv（如 `VH IMGT49 ↔ VL IMGT120`）还可能含有跨链稳定二硫键（共 6 个成对 Cys）。仅当经 3D 严格 1-to-1 链内+跨链配对后仍存在未配对游离 Cys（`Free: Yes`）时，才触发 **Tier 1 Intolerable（RED）** 警报。',
    method:
      '对完整 Fv 的 VH 与 VL 全部 Cys 执行严格 1-to-1 最大基数最小距离匹配（同时识别链内与 VH–VL 跨链二硫键）：满足 Sγ–Sγ ≤ 3.5 Å，或弛豫容差（Cβ–Cβ ≤ 5.0 Å 且 Sγ–Sγ ≤ 5.5 Å），缺 Sγ 时 Cβ–Cβ ≤ 4.8 Å，及同链保守 IMGT 23–104 结合 Cα–Cα ≤ 7.5 Å 复核均判为成对二硫键。未配对者标为 `Free: Yes`。',
    formula:
      '1-to-1 Match(VH ∪ VL): d(Sγ) ≤ 3.5 Å ∨ (d(Cβ) ≤ 5.0 Å ∧ d(Sγ) ≤ 5.5 Å);   Unpaired → Tier 1 RED',
    example:
      '• 标准正常示例：`4 (Free: No)`（VH 与 VL 链内二硫键全部闭合，标为 D-GREEN）；\n• 工程化 ds-scFv 示例：`6 (Free: No; Inter-chain: VH:44@IMGT49(C)-VL:100@IMGT120(C))`（跨链二硫键正确配对，标为 D-GREEN）；\n• 游离风险示例：`5 (Free: Yes @ VH:102@IMGT110(C)[CDR-Loop,Exp])`（标为 Tier 1 RED）。'
  },
  VH_Cys: {
    label: 'VH Chain · Heavy Chain Cysteine & Disulfide Status (重链半胱氨酸与二硫键状态)',
    shortLabel: 'VH Cys',
    summary:
      '评估重链可变区（VH）内半胱氨酸（Cys, C）总数及 3D 二硫键配对完整性。标准 VH 含有 2 个保守 Cys（`IMGT Cys23` 与 `IMGT Cys104`）；部分长 CDRH3 抗体可在 CDRH3 内部形成第 2 对链内二硫键（共 4 个配对 Cys）；工程化 ds-scFv 重链还可能与 VL 形成跨链二硫键（如 `IMGT49 ↔ VL IMGT120`）。一旦存在未配对游离 Cys，属于 **Tier 1 Intolerable（RED）**。',
    method:
      '在完整 Fv 3D 结构中执行严格 1-to-1 二硫键配对（组合几何判据：Sγ–Sγ ≤ 3.5 Å，或 Cβ–Cβ ≤ 5.0 Å 且 Sγ–Sγ ≤ 5.5 Å，缺 Sγ 时 Cβ–Cβ ≤ 4.8 Å，同链 23–104 支持 Cα–Cα ≤ 7.5 Å 复核），同时支持链内与 VH–VL 跨链二硫键。未配对者判定为游离巯基并输出精确 3D 坐标。',
    formula:
      '1-to-1 Paired (Intra-VH or Inter-VH/VL): d(Sγ) ≤ 3.5 Å ∨ (d(Cβ) ≤ 5.0 Å ∧ d(Sγ) ≤ 5.5 Å);   Unpaired → Tier 1 RED',
    example:
      '• 标准二硫键：`2 (Free: No)`（IMGT Cys23–Cys104 配对，标为 D-GREEN）；\n• 双二硫键正常配对：`4 (Free: No)`（Cys23–Cys104 + CDRH3 内部二硫键，标为 D-GREEN）；\n• ds-scFv 跨链配对：`3 (Free: No; Inter-chain: 44@IMGT49(C)-VL:100@IMGT120(C))`（标为 D-GREEN）；\n• 游离巯基高危：`3 (Free: Yes @ 102@IMGT110(C)[CDR-Loop,Exp])`（标为 Tier 1 RED）。'
  },
  VL_Cys: {
    label: 'VL Chain · Light Chain Cysteine & Disulfide Status (轻链半胱氨酸与二硫键状态)',
    shortLabel: 'VL Cys',
    summary:
      '评估轻链可变区（VL）内半胱氨酸（Cys, C）总数及 3D 二硫键配对完整性。标准人源 κ 和 λ 轻链可变区含 2 个保守 Cys（`IMGT Cys23` 与 `IMGT Cys104`）；工程化 ds-scFv 轻链常在 `IMGT 120`（Kabat L100）引入第 3 个 Cys 与重链 `IMGT 49` 形成跨链二硫键。除成对链内/跨链二硫键外，任何孤立游离 Cys 均属于 **Tier 1 Intolerable（RED）**。',
    method:
      '在完整 Fv 3D 结构中执行严格 1-to-1 二硫键配对（Sγ–Sγ ≤ 3.5 Å，或 Cβ–Cβ ≤ 5.0 Å 且 Sγ–Sγ ≤ 5.5 Å，缺 Sγ 时 Cβ–Cβ ≤ 4.8 Å，同链 23–104 支持 Cα–Cα ≤ 7.5 Å），同时识别 VL 链内与 VH–VL 跨链二硫键；未配对者标为 `Free: Yes`（**RED**）。',
    formula:
      '1-to-1 Paired (Intra-VL or Inter-VH/VL): d(Sγ) ≤ 3.5 Å ∨ (d(Cβ) ≤ 5.0 Å ∧ d(Sγ) ≤ 5.5 Å);   Unpaired → Tier 1 RED',
    example:
      '• 标准正常示例：`2 (Free: No)`（轻链 Cys23–Cys104 正常配对，标为 D-GREEN）；\n• ds-scFv 跨链配对：`3 (Free: No; Inter-chain: 100@IMGT120(C)-VH:44@IMGT49(C))`（标为 D-GREEN）；\n• 游离风险示例：`3 (Free: Yes @ 91@IMGT107(C)[CDR-Loop,Exp])`（标为 Tier 1 RED）。'
  },
  VHH_Cys: {
    label: 'VHH Domain · Nanobody Cysteine & Disulfide Status (纳米抗体半胱氨酸与非典型二硫键)',
    shortLabel: 'VHH Cys',
    summary:
      '评估单域纳米抗体（VHH）内半胱氨酸总数及二硫键配对状态。除了保守的 `IMGT Cys23–Cys104` 核心二硫键外，许多天然驼源/羊驼源 VHH 会在 **CDR1（IMGT 35–38）或 FR2（IMGT 50/55）与长 CDR3 环之间形成第 2 对跨环非典型二硫键（共 4 个配对 Cys）**；若存在未配对的游离 Cys，则属于 **Tier 1 Intolerable（RED）**。',
    method:
      '在 3D 结构中执行严格 1-to-1 二硫键配对（Sγ–Sγ ≤ 3.5 Å，或 Cβ–Cβ ≤ 5.0 Å 且 Sγ–Sγ ≤ 5.5 Å，缺 Sγ 时 Cβ–Cβ ≤ 4.8 Å，保守 23–104 支持 Cα–Cα ≤ 7.5 Å 复核），精确检验每一对核心及跨环二硫键是否闭合。全部配对标为 **D-GREEN**，存在孤立游离 Cys 标为 **RED**。',
    formula:
      '1-to-1 Match(VHH): d(Sγ) ≤ 3.5 Å ∨ (d(Cβ) ≤ 5.0 Å ∧ d(Sγ) ≤ 5.5 Å) → Free: No (D-GREEN)',
    example:
      '• 单二硫键 VHH：`2 (Free: No)`（D-GREEN）；\n• 含跨环二硫键 VHH：`4 (Free: No)`（Cys23–Cys104 + CDR1/FR2–CDR3 跨环二硫键正常配对，标为 D-GREEN）；\n• 游离巯基 VHH：`3 (Free: Yes @ 108@IMGT112(C)[CDR-Loop,Exp])`（标为 Tier 1 RED）。'
  },

  // ============================================================================
  // 5. METADATA & SEQUENCE COLUMNS IN RESULTS TABLE
  // ============================================================================
  Target_Name: {
    label: 'Antibody / Target Identifier (抗体或分子唯一标识名称)',
    shortLabel: 'Target Name',
    summary:
      '候选抗体、纳米抗体或临床参考库分子的唯一标识名称（来源于上传的 FASTA 序列头 `>Header`、PDB 文件名或 TheraSAbDab 国际非专利药品名称 INN）。',
    method:
      '在 Results 表格中固定于首列（Sticky Column），支持通过右上角搜索框按名称关键字实时过滤，并按自然字母数字顺序（Natural Sort）自动排序。',
    example:
      '例如：`Trastuzumab`、`Caplacizumab` 或自定义批次分子 `Ab_Candidate_01`。'
  },
  Antibody_ID: {
    label: 'Antibody / Target Identifier (抗体或分子唯一标识名称)',
    shortLabel: 'Antibody ID',
    summary:
      '候选抗体、纳米抗体或临床参考库分子的唯一标识名称（来源于上传的 FASTA 序列头 `>Header`、PDB 文件名或 TheraSAbDab 国际非专利药品名称 INN）。',
    method:
      '在 Results 表格中固定于首列（Sticky Column），支持按名称关键字实时过滤。',
    example:
      '例如：`Trastuzumab`、`Pembrolizumab`、`Caplacizumab`。'
  },
  Genetics: {
    label: 'Genetic Origin & Format (基因源性与工程化分类)',
    shortLabel: 'Genetics',
    summary:
      '表征临床治疗性抗体的基因物种来源与人源化工程改造类别（来源于 TheraSAbDab 权威注释）。不同基因源性的抗体在骨架区（FR）氨基酸组成、免疫原性风险及 1D/3D 理化基线分布上存在显著差异。',
    method:
      '支持在 Guidelines 筛选器中按 Genetics 多选过滤，常见类别包括：\n• `Human`（全人源，如转基因小鼠或人源噬菌体库筛选）；\n• `Humanised`（人源化，鼠源/兔源 CDR 嫁接至人源 FR 骨架）；\n• `Chimeric`（人鼠嵌合，鼠源可变区 V 拼接人源恒定区 C）；\n• `Mouse`（全鼠源）；\n• `Bispecific` / `Human; Bispecific`（双特异性抗体格式）。',
    example:
      '例如：Adalimumab 为 `Human`（全人源），Trastuzumab 为 `Humanised`（人源化），Rituximab 为 `Chimeric`（嵌合抗体）。'
  },
  Highest_Clin_Trial: {
    label: 'Highest Clinical Stage (最高临床研发阶段)',
    shortLabel: 'Clinical Stage',
    summary:
      '参考库治疗性抗体当前达到的最高临床试验或上市批准阶段（如 `Approved`、9 期临床 `Phase 3`、`Phase 2`、`Phase 1`、`Preregistration`）。临床阶段越靠后，代表该分子已经过更大规模的人体安全性、PK 与 CMC 可开发性验证。',
    method:
      '可在 Guidelines 筛选器中勾选特定阶段（如仅勾选 `Approved` 已获批上市药物），从而将所有 5 级分位数色阶收紧至已上市抗体的最高标准。',
    example:
      '例如：`Approved`（已获批上市）、`Phase 3`（III 期临床）、`Phase 2`（II 期临床）。'
  },
  Clinical_Stage: {
    label: 'Highest Clinical Stage (最高临床研发阶段)',
    shortLabel: 'Clinical Stage',
    summary:
      '参考库治疗性抗体当前达到的最高临床试验或上市批准阶段（如 `Approved`、`Phase 3`、`Phase 2`、`Phase 1`）。',
    method:
      '可在 Guidelines 筛选器中勾选特定阶段，动态重算分位数基线。',
    example:
      '例如：`Approved`（已获批上市）、`Phase 3`（III 期临床）。'
  },
  VH: {
    label: 'VH Amino Acid Sequence (重链可变区氨基酸序列)',
    shortLabel: 'VH Sequence',
    unit: 'FASTA 1-Letter',
    summary:
      '抗体重链可变区（VH）或单域纳米抗体（VHH）的完整一维单字母氨基酸序列（从 N 端 FR1 第 1 位至 C 端 FR4 末端）。',
    method:
      '用于执行 ANARCI IMGT 编号、ABodyBuilder2/NanoBodyBuilder2 三维结构建模、1D 理化性质计算及 4-Tier PTM 基序扫描。在表格中悬停可查看完整序列。',
    example:
      '例如：`EVQLVESGGGLVQPGGSLRLSCAASGFNIKDTYIHWVRQAPGKGLEWVARIYPTNGYTRYADSVKGRFTISADTSKNTAYLQMNSLRAEDTAVYYCSRWGGDGFYAMDYWGQGTLVTVSS`'
  },
  VL: {
    label: 'VL Amino Acid Sequence (轻链可变区氨基酸序列)',
    shortLabel: 'VL Sequence',
    unit: 'FASTA 1-Letter',
    summary:
      '传统单抗轻链可变区（VL，κ 或 λ 链）的完整一维单字母氨基酸序列（从 N 端 FR1 第 1 位至 C 端 FR4 末端）。纳米抗体（TNP）无此列。',
    method:
      '与配对的 VH 序列共同输入 ABodyBuilder2 构建 Fv 3D 复合模型，并参与 VL 单链与 VH+VL 双链联合指标计算。',
    example:
      '例如：`DIQMTQSPSSLSASVGDRVTITCRASQDVNTAVAWYQQKPGKAPKLLIYSASFLYSGVPSRFSGSRSGTDFTLTISSLQPEDFATYYCQQHYTTPPTFGQGTKVEIK`'
  },
  Error_Message: {
    label: 'Pipeline Status & Diagnostic Log (流程状态与异常诊断信息)',
    shortLabel: 'Error Message',
    summary:
      '记录每个目标分子在远程集群执行 ImmuneBuilder 建模、ANARCI 编号、Joy PSA 溶剂可及性分析及 TAP/TNP 指标计算过程中的诊断信息。',
    method:
      '若全流程正常完成则为空（或 `None`）；若某一步骤发生异常（如序列不是有效免疫球蛋白可变区导致 ANARCI 编号失败，或 PDB 缺失重原子），在此列输出具体错误原因以便快速排查。',
    example:
      '正常完成时为空白；异常示例：`ANARCI failed to identify valid IMGT variable domain`。'
  }
};

// Generic fallback aliases mapped to the most informative chain-aware defaults
METRIC_META.Length = METRIC_META.VHVL_Length;
METRIC_META.Mol_Weight = METRIC_META.VHVL_Mol_Weight;
METRIC_META.pI = METRIC_META.VHVL_pI;
METRIC_META.GRAVY = METRIC_META.VHVL_GRAVY;
METRIC_META.Instability = METRIC_META.VHVL_Instability;
METRIC_META['Charge_pH7.4'] = METRIC_META['VHVL_Charge_pH7.4'];
METRIC_META.N_Glyco_Count = METRIC_META.VHVL_N_Glyco_Count;
METRIC_META.NGlycSites = METRIC_META.VHVL_NGlycSites;
METRIC_META.Deamidation = METRIC_META.VHVL_Deamidation;
METRIC_META.Isomerization = METRIC_META.VHVL_Isomerization;
METRIC_META.Cleavage = METRIC_META.VHVL_Cleavage;
METRIC_META.Oxidation = METRIC_META.VHVL_Oxidation;
METRIC_META.Cys = METRIC_META.VHVL_Cys;

export function resolveMetricMeta(headerOrMetric: string, modalityHint?: 'TAP' | 'TNP'): MetricMetaItem | null {
  const clean = headerOrMetric.replace('_Value', '').trim();

  // 1. Direct match (e.g., TAP_PSH, TNP_PSH, VH_Mol_Weight, VL_pI, VHVL_Instability, VHH_GRAVY)
  if (METRIC_META[clean]) {
    if (modalityHint === 'TNP' && METRIC_META[`TNP_${clean}`]) {
      return METRIC_META[`TNP_${clean}`];
    }
    if (modalityHint === 'TAP' && METRIC_META[`TAP_${clean}`]) {
      return METRIC_META[`TAP_${clean}`];
    }
    return METRIC_META[clean];
  }

  // 2. Canonical aliases
  if (clean === 'Total CDR Length (L_tot)' || clean === 'Total_CDR_Length') {
    return modalityHint === 'TNP' ? METRIC_META.TNP_L : METRIC_META.TAP_L_tot;
  }
  if (clean === 'CDR3_Length') return METRIC_META.TNP_L3;
  if (clean === 'CDR3_Compactness') return METRIC_META.TNP_C;
  if (clean === 'Error Message') return METRIC_META.Error_Message;
  if (clean === 'Target Name') return METRIC_META.Target_Name;

  // 3. Chain-prefixed properties: ^(VHVL|VH|VL|VHH)_(.*)$
  const m = clean.match(/^(VHVL|VH|VL|VHH)_(.*)$/);
  if (m) {
    const chain = m[1];
    const rawProp = m[2];

    let canonicalProp = rawProp;
    if (rawProp === 'MW' || rawProp === 'Mol_Weight') canonicalProp = 'Mol_Weight';
    else if (rawProp === 'pI') canonicalProp = 'pI';
    else if (rawProp === 'GRAVY') canonicalProp = 'GRAVY';
    else if (rawProp === 'Instability') canonicalProp = 'Instability';
    else if (rawProp === 'Charge' || rawProp === 'Charge_pH7.4') canonicalProp = 'Charge_pH7.4';
    else if (rawProp === 'NGlyc' || rawProp === 'NGlyc_Count' || rawProp === 'N_Glyco_Count') canonicalProp = 'N_Glyco_Count';
    else if (rawProp === 'NGlycSites' || rawProp === 'NGlyc_Sites') canonicalProp = 'NGlycSites';
    else if (rawProp === 'Cys' || rawProp === 'Free_Cys') canonicalProp = 'Cys';

    const exactKey = `${chain}_${canonicalProp}`;
    if (METRIC_META[exactKey]) {
      return METRIC_META[exactKey];
    }
  }

  return null;
}

interface InfoTooltipProps {
  title?: string;
  unit?: string;
  summary?: string;
  description?: string;
  method?: string;
  formula?: string;
  example?: string;
  note?: string;
  align?: 'left' | 'center' | 'right';
}

export default function InfoTooltip({
  title,
  unit,
  summary,
  description,
  method,
  formula,
  example,
  note,
  align = 'center'
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 430
  });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const autoMeta = title ? resolveMetricMeta(title) : null;
  const resolvedTitle = title || autoMeta?.label || '参数与算法说明';
  const resolvedUnit = unit || autoMeta?.unit;
  const bodyText = summary || description || autoMeta?.summary || '';
  const resolvedMethod = method || autoMeta?.method;
  const resolvedFormula = formula || autoMeta?.formula;
  const resolvedExample = example || autoMeta?.example;
  const resolvedNote = note || autoMeta?.benchmarkNote;

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleOpen = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const handleScheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 150);
  };

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const desiredWidth = Math.min(440, vw - 24);
    const popHeight = popoverRef.current?.offsetHeight || 300;

    // Horizontal positioning with strict viewport clamping
    let left: number;
    if (align === 'left') {
      left = rect.left;
    } else if (align === 'right') {
      left = rect.right - desiredWidth;
    } else {
      left = rect.left + rect.width / 2 - desiredWidth / 2;
    }
    left = Math.max(12, Math.min(vw - desiredWidth - 12, left));

    // Vertical positioning: prefer below if near top sticky header, or above if near bottom
    const spaceBelow = vh - rect.bottom - 14;
    const spaceAbove = rect.top - 72;

    let top: number;
    if (spaceBelow >= popHeight || spaceBelow >= spaceAbove) {
      top = Math.min(vh - popHeight - 12, rect.bottom + 8);
    } else {
      top = Math.max(12, rect.top - popHeight - 8);
    }

    setCoords({ top: Math.max(12, top), left, width: desiredWidth });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={handleOpen}
      onMouseLeave={handleScheduleClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(v => !v);
        }}
        className="text-slate-400 hover:text-brand-600 transition-colors focus:outline-none p-0.5 rounded"
        aria-label={resolvedTitle}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            onMouseEnter={handleOpen}
            onMouseLeave={handleScheduleClose}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`
            }}
            className="z-[9999] max-h-[82vh] overflow-y-auto custom-scrollbar bg-slate-900/98 backdrop-blur-md text-slate-100 rounded-xl p-4 shadow-2xl border border-slate-700 text-left font-sans normal-case tracking-normal space-y-2.5"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white leading-snug">{resolvedTitle}</span>
              {resolvedUnit && (
                <span className="text-[10px] font-mono font-semibold text-cyan-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 shrink-0">
                  单位: {resolvedUnit}
                </span>
              )}
            </div>

            {/* 1. Parameter Definition & Meaning */}
            {bodyText && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  <BookOpen className="w-3 h-3 shrink-0" />
                  <span>参数定义与成药性意义</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed font-normal whitespace-pre-line">
                  {bodyText}
                </p>
              </div>
            )}

            {/* 2. Calculation Method */}
            {resolvedMethod && (
              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  <Calculator className="w-3 h-3 shrink-0" />
                  <span>计算方法与判定准则</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                  {resolvedMethod}
                </p>
              </div>
            )}

            {/* 3. Mathematical Formula */}
            {resolvedFormula && (
              <div className="px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-[10.5px] font-mono text-cyan-300 break-words whitespace-pre-wrap leading-relaxed">
                <span className="text-slate-400 select-none">公式/规则: </span>
                {resolvedFormula}
              </div>
            )}

            {/* 4. Concrete Example */}
            {resolvedExample && (
              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>实例说明</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-normal whitespace-pre-line bg-slate-800/60 px-2.5 py-2 rounded-lg border border-slate-700/60">
                  {resolvedExample}
                </p>
              </div>
            )}

            {/* Footer Note */}
            {resolvedNote && (
              <div className="pt-1 text-[10px] text-slate-400 font-normal border-t border-slate-800/60">
                {resolvedNote}
              </div>
            )}
          </div>,
          document.body
        )}
    </span>
  );
}
