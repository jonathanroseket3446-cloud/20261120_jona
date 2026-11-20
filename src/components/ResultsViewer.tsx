import { toast } from 'sonner';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Loader2, AlertTriangle, FileText, Download, Sheet, Search, Filter, X } from 'lucide-react';
import InfoTooltip, { resolveMetricMeta } from './InfoTooltip';

interface ResultsViewerProps {
  batchId: string;
  remoteBasePath: string;
  onClose: () => void;
}

type ColumnGroupFilter = 'ALL' | '3D' | 'VHVL' | 'VH' | 'VL' | 'PTM';

const HEADER_TOOLTIPS: Record<string, { title: string; unit?: string; description: string; formula?: string }> = {
  L_tot: {
    title: 'Total CDR Length (L_tot)',
    unit: 'AA',
    description: 'Sum of amino acid lengths across all 6 IMGT CDR loops (H1–H3, L1–L3).',
    formula: 'Σ len(CDRH1..3) + Σ len(CDRL1..3)'
  },
  PSH: {
    title: 'Patches of Surface Hydrophobicity (PSH)',
    description: '3D CDR-vicinity surface hydrophobicity score weighted by PSA solvent accessibility and inverse squared Cα distance (≤ 7.5 Å).',
    formula: 'Σ r_i · r_j · A_i · A_j / d_ij²'
  },
  PPC: {
    title: 'Patches of Positive Charge (PPC)',
    description: '3D CDR-vicinity positive electrostatic patch score at pH 7.4 (Arg, Lys, His).',
    formula: 'Σ q⁺_i · q⁺_j / d_ij²'
  },
  PNC: {
    title: 'Patches of Negative Charge (PNC)',
    description: '3D CDR-vicinity negative electrostatic patch score at pH 7.4 (Asp, Glu).',
    formula: 'Σ |q⁻_i| · |q⁻_j| / d_ij²'
  },
  SFvCSP: {
    title: 'Structural Fv Charge Symmetry Parameter',
    description: 'Product of net VH and VL surface charges at pH 7.4. Negative values indicate favorable VH/VL dipole opposition.',
    formula: 'Q_surf(VH) × Q_surf(VL)'
  },
  TAP: {
    title: 'TAP Overall Flag',
    description: 'Worst-case developability tier across the 5 structural 3D TAP metrics (L_tot, PSH, PPC, PNC, SFvCSP).'
  },
  L: {
    title: 'Total CDR Length (L)',
    unit: 'AA',
    description: 'Sum of IMGT CDR1 + CDR2 + CDR3 lengths in the VHH domain.',
    formula: 'len(CDR1) + len(CDR2) + len(CDR3)'
  },
  L3: {
    title: 'CDR3 Length (L3)',
    unit: 'AA',
    description: 'Length of IMGT CDR3 loop (positions 105–117) in the VHH domain.'
  },
  C: {
    title: 'CDR3 Compactness (C)',
    description: 'Ratio of CDR3 loop length to its radius of gyration around the VHH centroid.',
    formula: 'L3 / Rg(CDR3)'
  },
  Tetrad: {
    title: 'FR2 Hallmark Tetrad',
    description: 'Amino acid composition at IMGT positions 42, 49, 50, and 52 in VHH FR2 (solubilizing camelid hallmark).'
  },
  TNP: {
    title: 'TNP Overall Flag',
    description: 'Worst-case developability tier across the structural 3D TNP metrics (L, L3, C, PSH, PPC, PNC).'
  },
  Length: {
    title: 'Sequence Length',
    unit: 'AA',
    description: 'Total variable domain amino acid count.'
  },
  MW: {
    title: 'Molecular Weight',
    unit: 'Da',
    description: 'Polypeptide mass accounting for peptide bond dehydration (two-chain Fv subtracts 2 × H2O).'
  },
  pI: {
    title: 'Isoelectric Point (pI)',
    unit: 'pH',
    description: 'Exact pH where net polypeptide charge equals zero using Henderson-Hasselbalch bisection (VH+VL preserves 2 N-termini and 2 C-termini).'
  },
  GRAVY: {
    title: 'Grand Average of Hydropathy (GRAVY)',
    description: 'Length-weighted average of Kyte-Doolittle hydropathy values.'
  },
  Instability: {
    title: 'Guruprasad Instability Index',
    description: 'Dipeptide instability weight score (< 40 indicates stable protein; VH+VL avoids artificial junction dipeptide).'
  },
  Charge: {
    title: 'Net Charge at pH 7.4',
    unit: 'e',
    description: 'Net physiological electrostatic charge calculated via Henderson-Hasselbalch pKa values at pH 7.4.'
  },
  NGlyc: {
    title: 'N-Glycosylation Motif Count',
    description: 'Number of canonical N-X-[S/T] (X ≠ P) sequons. Any presence (> 0) is flagged Intolerable (RED).'
  },
  NGlycSites: {
    title: 'N-Glycosylation Sites',
    description: 'Annotated as linearPos@IMGTpos(Motif)[CDR-Loop/FR-Loop/FR-Strand,Exp/Buried]. Intolerable tier (RED) regardless of exposure.'
  },
  Deamidation: {
    title: 'Asn Deamidation Sites',
    description: 'High Risk (RED): NG in exposed loops. Moderate Risk (AMBER): NS, NT, NN, NH in exposed loops. Low Risk (L-GREEN): other 15 Nx (including NP) in exposed loops. Protected (D-GREEN): buried or β-strand sites.'
  },
  Isomerization: {
    title: 'Asp Isomerization Sites',
    description: 'High Risk (RED): DG in exposed loops. Moderate Risk (AMBER): DS, DD in exposed loops. Low Risk (L-GREEN): other 17 Dx (including DP, DT, DH) in exposed loops. Protected (D-GREEN): buried or β-strand sites.'
  },
  Cleavage: {
    title: 'Asp-Pro (DP) Sites',
    description: 'Low Risk (L-GREEN): DP in exposed loops (unified under Isomerization Tier 4 Low Risk). Protected (D-GREEN): buried or β-strand sites.'
  },
  Oxidation: {
    title: 'Met / Trp Oxidation Sites',
    description: 'Moderate Risk (AMBER): M or W in exposed loops (exposed & in loops). Protected (D-GREEN): buried or β-strand sites (e.g. IMGT M39, M91, W41, W52, W118).'
  },
  Cys: {
    title: 'Cysteine & Free Thiol Status',
    description: 'Total cysteine count and 1-to-1 3D intra/inter-chain disulfide pairing check (Sγ–Sγ ≤ 3.5 Å, or relaxed Cβ–Cβ ≤ 5.0 Å & Sγ–Sγ ≤ 5.5 Å). Unpaired free thiol (Free: Yes) is flagged Intolerable (RED).'
  }
};

// Biopython IsoelectricPoint (Bjellqvist et al.) exact pKa tables
const PKA_POS: Record<string, number> = { K: 10.0, R: 12.0, H: 5.98 };
const PKA_NEG: Record<string, number> = { D: 4.05, E: 4.45, C: 9.0, Y: 10.0 };
const PKA_N_TERM: Record<string, number> = {
  A: 7.59, M: 7.0, S: 6.93, P: 8.36, T: 6.82, V: 7.44, E: 7.7
};
const DEFAULT_N_TERM_PKA = 7.5;
const PKA_C_TERM: Record<string, number> = { D: 4.55, E: 4.75 };
const DEFAULT_C_TERM_PKA = 3.55;

function computeExactChainNetCharge(seq: string, pH: number): number {
  const s = (seq || '').trim().toUpperCase();
  if (!s) return 0;
  const nPka = PKA_N_TERM[s[0]] ?? DEFAULT_N_TERM_PKA;
  const cPka = PKA_C_TERM[s[s.length - 1]] ?? DEFAULT_C_TERM_PKA;
  let pos = 1.0 / (1.0 + Math.pow(10, pH - nPka));
  let neg = 1.0 / (1.0 + Math.pow(10, cPka - pH));
  for (let i = 0; i < s.length; i++) {
    const aa = s[i];
    if (PKA_POS[aa] !== undefined) {
      pos += 1.0 / (1.0 + Math.pow(10, pH - PKA_POS[aa]));
    } else if (PKA_NEG[aa] !== undefined) {
      neg += 1.0 / (1.0 + Math.pow(10, PKA_NEG[aa] - pH));
    }
  }
  return pos - neg;
}

function solveTwoChainIsoelectricPoint(vhSeq: string, vlSeq: string): number {
  let low = 4.05;
  let high = 12.0;
  for (let iter = 0; iter < 60; iter++) {
    const mid = 0.5 * (low + high);
    const net = computeExactChainNetCharge(vhSeq, mid) + computeExactChainNetCharge(vlSeq, mid);
    if (net > 0) low = mid;
    else high = mid;
  }
  return 0.5 * (low + high);
}

export default function ResultsViewer({ batchId, remoteBasePath, onClose }: ResultsViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tapData, setTapData] = useState<string[][]>([]);
  const [tnpData, setTnpData] = useState<string[][]>([]);
  const [guidelines, setGuidelines] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [colGroup, setColGroup] = useState<ColumnGroupFilter>('ALL');
  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const [includeFrLoops, setIncludeFrLoops] = useState(false);

  useEffect(() => {
    fetchResults();
  }, []);

  const inferSiteContextTag = (pos: number, motif: string, chain: string): string => {
    const isVL = chain === 'VL';
    const cdr1Start = isVL ? 27 : 26;
    const cdr1End = isVL ? 34 : 35;
    const cdr2Start = isVL ? 50 : 50;
    const cdr2End = isVL ? 56 : 59;
    const cdr3Start = isVL ? 89 : 97;

    const isCdr =
      (pos >= cdr1Start && pos <= cdr1End) ||
      (pos >= cdr2Start && pos <= cdr2End) ||
      (pos >= cdr3Start && pos <= (isVL ? 97 : 109));

    const isFrLoop =
      !isCdr &&
      ((pos >= 13 && pos <= 17) ||
        (pos >= 40 && pos <= 44) ||
        (!isVL && pos >= 61 && pos <= 66) ||
        (pos >= (isVL ? 66 : 72) && pos <= (isVL ? 70 : 77)) ||
        (pos >= (isVL ? 79 : 85) && pos <= (isVL ? 82 : 89)));

    let isExp = true;
    if (motif === 'W') {
      const wFr2 = isVL ? 35 : 36;
      if (!isCdr || pos === wFr2 || Math.abs(pos - (wFr2 + 11)) <= 1 || pos >= (isVL ? 98 : 110)) {
        isExp = false;
      }
    } else if (motif === 'M') {
      if (!isCdr || pos === cdr1End || (!isVL && pos === 48)) {
        isExp = false;
      }
    }

    const regionLabel = isCdr ? 'CDR-Loop' : isFrLoop ? 'FR-Loop' : 'FR-Strand';
    return `[${regionLabel},${isExp ? 'Exp' : 'Buried'}]`;
  };

  const splitPtmTokens = (valStr: string): string[] => {
    if (!valStr || valStr.trim() === '' || valStr.trim() === 'None') return [];
    return valStr
      .split(/,\s*(?![^\[\]]*\])/)
      .map(s => s.trim())
      .filter(s => s && s !== 'None');
  };

  const normalizePtmValueWithTags = (valStr: string, defaultChain: string): string => {
    const tokens = splitPtmTokens(valStr);
    if (tokens.length === 0) return valStr;
    return tokens
      .map(token => {
        const m = token.match(/^(?:(VH|VL|VHH):)?(\d+)(?:@IMGT([0-9A-Za-z]+))?\(([A-Z]+)\)(?:\[([A-Za-z-]+),([A-Za-z]+)\])?$/);
        if (!m) return token;
        const prefix = m[1] ? `${m[1]}:` : '';
        const chainForCalc = m[1] || defaultChain;
        const pos = parseInt(m[2], 10);
        const imgtPart = m[3] ? `@IMGT${m[3]}` : '';
        const motif = m[4];
        if (m[5] && m[6]) {
          return `${prefix}${pos}${imgtPart}(${motif})[${m[5]},${m[6]}]`;
        }
        const inferredTag = inferSiteContextTag(pos, motif, chainForCalc);
        return `${prefix}${pos}${imgtPart}(${motif})${inferredTag}`;
      })
      .join(', ');
  };

  const calculateDynamicFlag = (header: string, valStr: string, isTNP: boolean) => {
    if (!guidelines || valStr === '') return null;
    let baseHeader = header.replace('_Value', '');
    if (baseHeader === 'Total CDR Length (L_tot)') baseHeader = 'L_tot';

    const match = baseHeader.match(/^(VHVL|VH|VL|VHH)_(.*)$/);
    if (match) {
      const chain = match[1];
      const prop = match[2];
      if (prop === 'Deamidation' || prop === 'Isomerization' || prop === 'Cleavage' || prop === 'Oxidation') {
        if (!valStr || valStr === 'None') return 'DARK_GREEN';
        const taggedStr = normalizePtmValueWithTags(valStr, chain === 'VHVL' ? 'VH' : chain);
        let hasHighRisk = false;
        let hasModerateRisk = false;
        let hasLowRisk = false;

        for (const token of splitPtmTokens(taggedStr)) {
          const m = token.match(/^(?:(VH|VL|VHH):)?(\d+)(?:@IMGT([0-9A-Za-z]+))?\(([A-Z]+)\)(?:\[([A-Za-z-]+),([A-Za-z]+)\])?$/);
          if (!m) continue;
          const motif = m[4];
          const region = m[5] || 'CDR-Loop';
          const exp = m[6] || 'Exp';
          const isCdrLoop = region === 'CDR-Loop' || region === 'CDR';
          const isFrLoop = region === 'FR-Loop';
          const isLoop = includeFrLoops ? (isCdrLoop || isFrLoop) : isCdrLoop;
          const isExp = exp === 'Exp';
          const isLoopExp = isLoop && isExp;

          if ((motif === 'NG' || motif === 'DG') && isLoopExp) {
            hasHighRisk = true;
          } else if (['M', 'W', 'NS', 'NT', 'NN', 'NH', 'DS', 'DD'].includes(motif) && isLoopExp) {
            hasModerateRisk = true;
          } else if (
            ((motif.startsWith('N') && motif.length === 2 && !['NG', 'NS', 'NT', 'NN', 'NH'].includes(motif)) ||
              (motif.startsWith('D') && motif.length === 2 && !['DG', 'DS', 'DD'].includes(motif))) &&
            isLoopExp
          ) {
            hasLowRisk = true;
          }
        }

        if (hasHighRisk) return 'RED';
        if (hasModerateRisk) return 'AMBER';
        if (hasLowRisk) return 'LIGHT_GREEN';
        return 'DARK_GREEN';
      }
      if (prop === 'Cys') {
        if (valStr.includes('Free: Yes')) return 'RED';
        else if (valStr.includes('Free: No')) return 'DARK_GREEN';
        return null;
      }
      if (prop === 'NGlycSites') {
        if (valStr && valStr !== 'None') return 'RED';
        else if (valStr === 'None') return 'DARK_GREEN';
        return null;
      }
    }

    const val = parseFloat(valStr);
    if (isNaN(val)) return null;

    let stats = null;
    if (isTNP && guidelines.tnp && guidelines.tnp[baseHeader]) {
      stats = guidelines.tnp[baseHeader];
    } else if (!isTNP && guidelines.tap && guidelines.tap[baseHeader]) {
      stats = guidelines.tap[baseHeader];
    }

    if (!stats && guidelines.therasabdab && match) {
      const chain = match[1];
      const prop = match[2];
      let statsKey = prop;
      if (prop === 'MW') statsKey = 'Mol_Weight';
      if (prop === 'Charge') statsKey = 'Charge_pH7.4';
      if (prop === 'NGlyc' || prop === 'NGlycSites') statsKey = 'N_Glyco_Count';

      const dataset = isTNP ? guidelines.therasabdab.VHH : guidelines.therasabdab.VHVL;
      stats = dataset?.[chain]?.[statsKey];

      if (statsKey === 'N_Glyco_Count') {
        if (val > 0) return 'RED';
        else return 'DARK_GREEN';
      }
    }

    if (stats && stats.count !== 0 && (stats.p0 !== undefined || stats.red_low !== undefined || stats.amber !== undefined || stats.red !== undefined)) {
      if (stats.p0 !== undefined) {
        if (val < stats.p0 || val > stats.p100) return 'RED';
        else if (val < stats.p5 || val > stats.p95) return 'AMBER';
        else if (val < stats.p10 || val > stats.p90) return 'LIGHT_GREEN';
        else if (val < stats.p25 || val > stats.p75) return 'MID_GREEN';
        else return 'DARK_GREEN';
      } else if (stats.red_low !== undefined && stats.green_25 !== undefined) {
        if (val < stats.red_low || val > stats.red_high) return 'RED';
        else if (val < stats.amber_low || val > (stats.amber_high || Infinity)) return 'AMBER';
        else if (val < stats.green_25 || val > stats.green_75) return 'LIGHT_GREEN';
        else if (val >= stats.green_25 && val <= stats.green_75) return 'DARK_GREEN';
        else return 'MID_GREEN';
      } else {
        if (val < stats.red_low || val > (stats.red_high || Infinity)) return 'RED';
        else if ((val >= stats.red_low && val <= (stats.amber_low || Infinity)) || (val >= (stats.amber_high || -Infinity) && val <= (stats.red_high || Infinity))) return 'AMBER';
        else return 'DARK_GREEN';
      }
    }
    return null;
  };

  const ensurePtmTagsInCsv = (parsed: string[][]): string[][] => {
    if (parsed.length <= 1) return parsed;
    const headers = parsed[0];
    const ptmColIndices: Array<{ colIdx: number; chain: string }> = [];
    headers.forEach((h, i) => {
      const base = h.replace('_Value', '');
      const m = base.match(/^(VHVL|VH|VL|VHH)_(NGlycSites|Deamidation|Isomerization|Cleavage|Oxidation)$/);
      if (m) {
        ptmColIndices.push({ colIdx: i, chain: m[1] === 'VHVL' ? 'VH' : m[1] });
      }
    });
    if (ptmColIndices.length === 0) return parsed;
    const updatedRows = parsed.slice(1).map(row => {
      const copy = [...row];
      for (const { colIdx, chain } of ptmColIndices) {
        if (copy[colIdx]) {
          copy[colIdx] = normalizePtmValueWithTags(copy[colIdx], chain);
        }
      }
      return copy;
    });
    return [headers, ...updatedRows];
  };

  const enrichTapCsvWithCombinedFv = (parsed: string[][]): string[][] => {
    const taggedParsed = ensurePtmTagsInCsv(parsed);
    if (taggedParsed.length <= 1) return taggedParsed;
    const headers = taggedParsed[0];
    if (headers.some(h => h.startsWith('VHVL_'))) return taggedParsed;

    const idx = (name: string) => {
      const i = headers.indexOf(name);
      return i !== -1 ? i : headers.indexOf(name.replace('_Value', ''));
    };

    const iLh = idx('VH_Length');
    const iLl = idx('VL_Length');
    if (iLh === -1 || iLl === -1) return taggedParsed;

    const iSeqH = headers.indexOf('VH');
    const iSeqL = headers.indexOf('VL');
    const iMWh = idx('VH_MW_Value');
    const iMWl = idx('VL_MW_Value');
    const iPIh = idx('VH_pI_Value');
    const iPIl = idx('VL_pI_Value');
    const iGh = idx('VH_GRAVY_Value');
    const iGl = idx('VL_GRAVY_Value');
    const iIh = idx('VH_Instability_Value');
    const iIl = idx('VL_Instability_Value');
    const iCh = idx('VH_Charge_Value');
    const iCl = idx('VL_Charge_Value');
    const iNGh = idx('VH_NGlyc');
    const iNGl = idx('VL_NGlyc');
    const iNGSh = idx('VH_NGlycSites_Value');
    const iNGSl = idx('VL_NGlycSites_Value');
    const iDeamH = idx('VH_Deamidation_Value');
    const iDeamL = idx('VL_Deamidation_Value');
    const iIsoH = idx('VH_Isomerization_Value');
    const iIsoL = idx('VL_Isomerization_Value');
    const iClvH = idx('VH_Cleavage_Value');
    const iClvL = idx('VL_Cleavage_Value');
    const iOxH = idx('VH_Oxidation_Value');
    const iOxL = idx('VL_Oxidation_Value');
    const iCysH = idx('VH_Cys_Value');
    const iCysL = idx('VL_Cys_Value');
    const errIdx = headers.findIndex(h => h === 'Error_Message' || h === 'Error Message');

    const hasCleavageCol = iClvH !== -1 && iClvL !== -1;
    const addedHeaders = [
      'VHVL_Length',
      'VHVL_MW_Value',
      'VHVL_pI_Value',
      'VHVL_GRAVY_Value',
      'VHVL_Instability_Value',
      'VHVL_Charge_Value',
      'VHVL_NGlyc',
      'VHVL_NGlycSites_Value',
      'VHVL_Deamidation_Value',
      'VHVL_Isomerization_Value',
      ...(hasCleavageCol ? ['VHVL_Cleavage_Value'] : []),
      'VHVL_Oxidation_Value',
      'VHVL_Cys_Value'
    ];

    const combineSites = (hVal: string, lVal: string) => {
      const parts: string[] = [];
      const hNorm = normalizePtmValueWithTags(hVal, 'VH');
      const lNorm = normalizePtmValueWithTags(lVal, 'VL');
      for (const tok of splitPtmTokens(hNorm)) {
        parts.push(tok.startsWith('VH:') ? tok : `VH:${tok}`);
      }
      for (const tok of splitPtmTokens(lNorm)) {
        parts.push(tok.startsWith('VL:') ? tok : `VL:${tok}`);
      }
      return parts.length > 0 ? parts.join(', ') : 'None';
    };

    const insertAt = errIdx !== -1 ? errIdx : headers.length;
    const newHeaders = [...headers.slice(0, insertAt), ...addedHeaders, ...headers.slice(insertAt)];

    const newRows = taggedParsed.slice(1).map(row => {
      const lH = parseFloat(row[iLh] || '0');
      const lL = parseFloat(row[iLl] || '0');
      const lTot = lH + lL;
      if (!lTot || isNaN(lTot)) {
        const empty = addedHeaders.map(() => '');
        return [...row.slice(0, insertAt), ...empty, ...row.slice(insertAt)];
      }
      const mwH = parseFloat(row[iMWh] || '0');
      const mwL = parseFloat(row[iMWl] || '0');
      const piH = parseFloat(row[iPIh] || '0');
      const piL = parseFloat(row[iPIl] || '0');
      const gH = parseFloat(row[iGh] || '0');
      const gL = parseFloat(row[iGl] || '0');
      const instH = parseFloat(row[iIh] || '0');
      const instL = parseFloat(row[iIl] || '0');
      const chH = parseFloat(row[iCh] || '0');
      const chL = parseFloat(row[iCl] || '0');
      const ngH = parseInt(row[iNGh] || '0', 10) || 0;
      const ngL = parseInt(row[iNGl] || '0', 10) || 0;

      const vhSeq = iSeqH !== -1 ? (row[iSeqH] || '').trim() : '';
      const vlSeq = iSeqL !== -1 ? (row[iSeqL] || '').trim() : '';
      const exactFvPi = vhSeq && vlSeq
        ? solveTwoChainIsoelectricPoint(vhSeq, vlSeq)
        : (lH * piH + lL * piL) / lTot;

      const cysStrH = row[iCysH] || '';
      const cysStrL = row[iCysL] || '';
      const cysCountH = parseInt(cysStrH, 10) || 0;
      const cysCountL = parseInt(cysStrL, 10) || 0;
      const hasFree = cysStrH.includes('Free: Yes') || cysStrL.includes('Free: Yes');
      const freeDetailParts: string[] = [];
      const mFreeH = cysStrH.match(/Free:\s*Yes\s*@\s*([^)]+)/);
      if (mFreeH && mFreeH[1]) freeDetailParts.push(`VH:${mFreeH[1].trim()}`);
      const mFreeL = cysStrL.match(/Free:\s*Yes\s*@\s*([^)]+)/);
      if (mFreeL && mFreeL[1]) freeDetailParts.push(`VL:${mFreeL[1].trim()}`);
      const cysCombined =
        cysStrH || cysStrL
          ? `${cysCountH + cysCountL} (Free: ${
              hasFree ? (freeDetailParts.length > 0 ? `Yes @ ${freeDetailParts.join('; ')}` : 'Yes') : 'No'
            })`
          : 'None';

      const computedCols = [
        String(lTot),
        (mwH + mwL).toFixed(1),
        exactFvPi.toFixed(2),
        ((lH * gH + lL * gL) / lTot).toFixed(3),
        ((lH * instH + lL * instL) / lTot).toFixed(2),
        (chH + chL).toFixed(2),
        String(ngH + ngL),
        combineSites(row[iNGSh] || 'None', row[iNGSl] || 'None'),
        combineSites(row[iDeamH] || 'None', row[iDeamL] || 'None'),
        combineSites(row[iIsoH] || 'None', row[iIsoL] || 'None'),
        ...(hasCleavageCol ? [combineSites(row[iClvH] || 'None', row[iClvL] || 'None')] : []),
        combineSites(row[iOxH] || 'None', row[iOxL] || 'None'),
        cysCombined
      ];

      return [...row.slice(0, insertAt), ...computedCols, ...row.slice(insertAt)];
    });

    return [newHeaders, ...newRows];
  };

  const fetchResults = async () => {
    try {
      // Unified 4D Filter Strategy synced with Guidelines.tsx
      const filterKeys = [
        'tapStages', 'tapGenetics', 'tapYears', 'tapTargets',
        'tnpStages', 'tnpGenetics', 'tnpYears', 'tnpTargets'
      ];
      const params = new URLSearchParams();
      let count = 0;
      for (const key of filterKeys) {
        try {
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(arr) && arr.length > 0) {
            params.append(key, arr.join(','));
            count += arr.length;
          }
        } catch {}
      }
      setActiveFilterCount(count);

      const [res, guidelinesRes] = await Promise.all([
        axios.get(`/api/jobs/${batchId}/results?remoteBasePath=${encodeURIComponent(remoteBasePath)}`),
        axios.get(`/api/guidelines?${params.toString()}`)
      ]);
      setGuidelines(guidelinesRes.data);

      const parseCsv = (csvStr: string) => {
        if (!csvStr || csvStr.trim() === '') return [];
        const parsed = csvStr.trim().split('\n').map(line => {
          const cleanLine = line.replace(/\r$/, '');
          const row = [];
          let cur = '';
          let inQuote = false;
          for (let i = 0; i < cleanLine.length; i++) {
            const char = cleanLine[i];
            if (char === '"' && cleanLine[i + 1] === '"') {
              cur += '"';
              i++;
            } else if (char === '"') {
              inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
              row.push(cur);
              cur = '';
            } else {
              cur += char;
            }
          }
          row.push(cur);
          return row;
        });

        if (parsed.length > 1) {
          const headers = parsed[0];
          const filenameIdx = headers.findIndex(h => h.toLowerCase() === 'filename' || h.toLowerCase() === 'target_name');
          if (filenameIdx !== -1) {
            const rows = parsed.slice(1);
            rows.sort((a, b) => {
              const aVal = a[filenameIdx] || '';
              const bVal = b[filenameIdx] || '';
              return aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
            });
            return [headers, ...rows];
          }
        }
        return parsed;
      };

      setTapData(enrichTapCsvWithCombinedFv(parseCsv(res.data.tapCsv)));
      setTnpData(ensurePtmTagsInCsv(parseCsv(res.data.tnpCsv)));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();

      const addSheet = (data: string[][], sheetName: string) => {
        if (data.length <= 1) return;
        const sheet = workbook.addWorksheet(sheetName);
        const headers = data[0];
        const rows = data.slice(1);

        const columns: Array<{ header: string; width: number }> = [];
        const headerIndices: number[] = [];

        const optionalMetaCols = new Set(['Genetics', 'Highest_Clin_Trial', 'Est. Status', 'Year Proposed', 'Year Recommended', 'Target', 'VL']);
        headers.forEach((h, i) => {
          if (h.endsWith('_Flag')) return;
          if (optionalMetaCols.has(h)) {
            const hasAnyVal = rows.some(r => (r[i] || '').trim() !== '');
            if (!hasAnyVal) return;
          }
          let headerName = h.replace('_Value', '');
          if (headerName === 'Target_Name') headerName = 'Target Name';
          if (headerName === 'L_tot') headerName = 'Total CDR Length (L_tot)';
          if (headerName === 'Error_Message') headerName = 'Error Message';
          columns.push({ header: headerName, width: Math.max(headerName.length + 5, 15) });
          headerIndices.push(i);
        });

        sheet.columns = columns;
        sheet.getRow(1).font = { bold: true, color: { argb: 'FF334155' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

        rows.forEach(row => {
          const rowData: string[] = [];
          const cellFlags: Array<{ colNumber: number; flag: string }> = [];

          headerIndices.forEach((origIdx, colIdx) => {
            const header = headers[origIdx];
            let cellValue = row[origIdx] || '';
            if (
              header.endsWith('_Value') ||
              ['L_tot', 'Total CDR Length (L_tot)', 'PSH', 'PPC', 'PNC', 'SFvCSP', 'L', 'L3', 'C'].includes(header) ||
              header.includes('MW') ||
              header.includes('pI') ||
              header.includes('GRAVY') ||
              header.includes('Instability') ||
              header.includes('Charge')
            ) {
              if (cellValue && !isNaN(Number(cellValue)) && cellValue.trim() !== '') {
                const num = Number(cellValue);
                if (!Number.isInteger(num)) {
                  cellValue = num.toFixed(2);
                }
              }
            }
            rowData.push(cellValue);

            let flag = calculateDynamicFlag(header, cellValue, sheetName.includes('TNP')) || '';
            if (!flag) {
              const flagHeader = header + '_Flag';
              const flagIdx = headers.indexOf(flagHeader);
              if (flagIdx !== -1) flag = row[flagIdx]?.trim().toUpperCase() || '';
              else if (header.endsWith('_Value') && headers[origIdx + 1] === header.replace('_Value', '_Flag')) {
                flag = row[origIdx + 1]?.trim().toUpperCase() || '';
              }
            }

            if (flag) {
              cellFlags.push({ colNumber: colIdx + 1, flag });
            }
          });

          const excelRow = sheet.addRow(rowData);

          cellFlags.forEach(({ colNumber, flag }) => {
            const cell = excelRow.getCell(colNumber);
            if (flag === 'RED') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF43F5E' } };
              cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            } else if (flag === 'AMBER') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBBF24' } };
              cell.font = { color: { argb: 'FF000000' }, bold: true };
            } else if (flag === 'GREEN' || flag === 'DARK_GREEN' || flag === 'D-GREEN') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
              cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            } else if (flag === 'MID_GREEN' || flag === 'M-GREEN') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34D399' } };
              cell.font = { color: { argb: 'FF064E3B' }, bold: true };
            } else if (flag === 'LIGHT_GREEN' || flag === 'L-GREEN') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA7F3D0' } };
              cell.font = { color: { argb: 'FF064E3B' }, bold: true };
            }
          });
        });
      };

      addSheet(tapData, 'TAP 2024 Antibodies');
      addSheet(tnpData, 'TNP 2025 Nanobodies');

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Analysis_Results_${batchId}.xlsx`);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      toast.error('Failed to export Excel file.');
    }
  };

  const getHeaderMeta = (rawHeader: string, isTNP: boolean) => {
    const resolved = resolveMetricMeta(rawHeader, isTNP ? 'TNP' : 'TAP');
    if (resolved) {
      return {
        title: resolved.label,
        unit: resolved.unit,
        description: resolved.summary,
        method: resolved.method,
        formula: resolved.formula,
        example: resolved.example,
        note: resolved.benchmarkNote
      };
    }
    const clean = rawHeader.replace('_Value', '');
    if (HEADER_TOOLTIPS[clean]) return HEADER_TOOLTIPS[clean];
    const m = clean.match(/^(VHVL|VH|VL|VHH)_(.*)$/);
    if (m && HEADER_TOOLTIPS[m[2]]) {
      const base = HEADER_TOOLTIPS[m[2]];
      return {
        ...base,
        title: `${m[1]} · ${base.title}`
      };
    }
    return null;
  };

  const matchesColumnGroup = (rawHeader: string, group: ColumnGroupFilter, isFirst: boolean) => {
    if (isFirst || rawHeader === 'Error_Message' || rawHeader === 'Error Message') return true;
    if (group === 'ALL') return true;
    const clean = rawHeader.replace('_Value', '');
    if (group === '3D') {
      return ['L_tot', 'Total CDR Length (L_tot)', 'PSH', 'PPC', 'PNC', 'SFvCSP', 'TAP', 'L', 'L3', 'C', 'Tetrad', 'TNP'].includes(clean);
    }
    if (group === 'VHVL') return clean.startsWith('VHVL_');
    if (group === 'VH') return clean.startsWith('VH_') || clean === 'VH' || clean.startsWith('VHH_');
    if (group === 'VL') return clean.startsWith('VL_') || clean === 'VL';
    if (group === 'PTM') {
      return /(NGlyc|NGlycSites|Deamidation|Isomerization|Cleavage|Oxidation|Cys)/.test(clean);
    }
    return true;
  };

  const renderTable = (data: string[][], title: string, subtitle: string) => {
    if (data.length <= 1) return null;
    const isTNPTable = title.includes('TNP');
    const headers = data[0];
    const allRows = data.slice(1);
    const rows = searchQuery.trim()
      ? allRows.filter(r => (r[0] || '').toLowerCase().includes(searchQuery.trim().toLowerCase()))
      : allRows;

    const optionalMetaCols = new Set(['Genetics', 'Highest_Clin_Trial', 'Est. Status', 'Year Proposed', 'Year Recommended', 'Target', 'VL']);
    const visibleColIndices = headers
      .map((h, i) => {
        if (h.endsWith('_Flag')) return -1;
        if (optionalMetaCols.has(h)) {
          const hasAnyVal = allRows.some(r => (r[i] || '').trim() !== '');
          if (!hasAnyVal) return -1;
        }
        if (!matchesColumnGroup(h, colGroup, i === 0)) return -1;
        return i;
      })
      .filter(idx => idx !== -1);

    return (
      <div className="mb-8 last:mb-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-surface-900 font-display">{title}</h3>
            <p className="text-xs text-surface-500">{subtitle}</p>
          </div>
          <span className="text-xs font-mono font-bold bg-surface-100 text-surface-700 px-2.5 py-1 rounded-md border border-surface-200">
            {rows.length} / {allRows.length} Targets
          </span>
        </div>
        <div className="overflow-x-auto border border-surface-200 rounded-xl shadow-xs bg-white custom-scrollbar max-h-[62vh]">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead className="bg-surface-50">
              <tr>
                {visibleColIndices.map((i, visIdx) => {
                  const h = headers[i];
                  const isFirst = visIdx === 0;
                  const meta = getHeaderMeta(h, isTNPTable);

                  let headerName = h.replace('_Value', '');
                  if (headerName === 'Target_Name') headerName = 'Target Name';
                  if (headerName === 'L_tot') headerName = 'L_tot (CDR Len)';
                  if (headerName === 'Error_Message') headerName = 'Error Message';
                  if (headerName === 'TAP') headerName = 'TAP Overall';
                  if (headerName === 'Tetrad') headerName = 'Tetrad (42,49,50,52)';
                  if (headerName === 'TNP') headerName = 'TNP Overall';
                  if (headerName.endsWith('_Length')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_MW')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_pI')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_GRAVY')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_Instability')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_Charge')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_NGlyc')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_NGlycSites')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_Deamidation')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_Isomerization')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_Cleavage')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_Oxidation')) headerName = headerName.replace('_', ' ');
                  if (headerName.endsWith('_Cys')) headerName = headerName.replace('_', ' ');

                  return (
                    <th
                      key={i}
                      className={`px-4 py-3 text-[11px] font-bold text-surface-600 uppercase tracking-wider whitespace-nowrap sticky top-0 border-b border-surface-200 bg-surface-50 ${
                        isFirst ? 'left-0 shadow-[1px_0_0_0_#e2e8f0] z-40' : 'z-30'
                      }`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>{headerName}</span>
                        {meta && (
                          <InfoTooltip
                            title={meta.title}
                            unit={meta.unit}
                            description={meta.description}
                            method={(meta as any).method}
                            formula={meta.formula}
                            example={(meta as any).example}
                            note={(meta as any).note}
                          />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-surface-50/80 transition-colors group">
                  {visibleColIndices.map((cIdx, visIdx) => {
                    const header = headers[cIdx];
                    let cell = row[cIdx] || '';
                    if (
                      header.endsWith('_Value') ||
                      ['L_tot', 'Total CDR Length (L_tot)', 'PSH', 'PPC', 'PNC', 'SFvCSP', 'L', 'L3', 'C'].includes(header) ||
                      header.includes('MW') ||
                      header.includes('pI') ||
                      header.includes('GRAVY') ||
                      header.includes('Instability') ||
                      header.includes('Charge')
                    ) {
                      if (cell && !isNaN(Number(cell)) && cell.trim() !== '') {
                        const num = Number(cell);
                        if (cell.includes('.') || !Number.isInteger(num)) {
                          cell = num.toFixed(2);
                        }
                      }
                    }

                    let flag = calculateDynamicFlag(header, cell, title.includes('TNP')) || '';
                    if (!flag) {
                      const flagHeader = header + '_Flag';
                      const flagIdx = headers.indexOf(flagHeader);
                      if (flagIdx !== -1) flag = row[flagIdx]?.trim().toUpperCase() || '';
                      else if (header.endsWith('_Value') && headers[cIdx + 1] === header.replace('_Value', '_Flag')) {
                        flag = row[cIdx + 1]?.trim().toUpperCase() || '';
                      }
                    }

                    const isFirst = visIdx === 0;
                    let flagDot = null;
                    if (flag === 'RED') {
                      flagDot = (
                        <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-rose-500 text-white font-bold text-[9px] uppercase border border-rose-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          RED
                        </div>
                      );
                    } else if (flag === 'AMBER') {
                      flagDot = (
                        <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-amber-400 text-amber-950 font-bold text-[9px] uppercase border border-amber-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-900" />
                          AMBER
                        </div>
                      );
                    } else if (flag === 'LIGHT_GREEN' || flag === 'L-GREEN') {
                      flagDot = (
                        <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-950 font-bold text-[9px] uppercase border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
                          L-GREEN
                        </div>
                      );
                    } else if (flag === 'MID_GREEN' || flag === 'M-GREEN') {
                      flagDot = (
                        <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-emerald-400 text-emerald-950 font-bold text-[9px] uppercase border border-emerald-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-900" />
                          M-GREEN
                        </div>
                      );
                    } else if (flag === 'GREEN' || flag === 'DARK_GREEN' || flag === 'D-GREEN') {
                      flagDot = (
                        <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[9px] uppercase border border-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          D-GREEN
                        </div>
                      );
                    }

                    const isPtmSiteCol = /(NGlycSites|Deamidation|Isomerization|Cleavage|Oxidation)/.test(header) && cell && cell !== 'None';
                    const isSeqCol = header === 'VH' || header === 'VL';

                    const renderCellContent = () => {
                      if (isSeqCol) {
                        return (
                          <span className="font-mono text-xs text-surface-600 max-w-[180px] truncate block" title={cell}>
                            {cell}
                          </span>
                        );
                      }
                      if (!isPtmSiteCol) {
                        return <span className={isFirst ? 'font-semibold text-xs' : 'font-mono text-xs'}>{cell}</span>;
                      }
                      const tokens = splitPtmTokens(cell);
                      return (
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] max-w-[420px] whitespace-normal">
                          {tokens.map((tok, tIdx) => {
                            const m = tok.match(/^((?:VH:|VL:|VHH:)?\d+)(?:@IMGT([0-9A-Za-z]+))?(\([A-Z]+\))(?:\[([A-Za-z-]+),([A-Za-z]+)\])?$/);
                            if (!m) {
                              return (
                                <span key={tIdx}>
                                  {tok}
                                  {tIdx < tokens.length - 1 ? ',' : ''}
                                </span>
                              );
                            }
                            const linearPart = m[1];
                            const imgtPart = m[2] ? `@IMGT${m[2]}` : '';
                            const motifPart = m[3];
                            const motif = motifPart.slice(1, -1);
                            const region = m[4] || '';
                            const exp = m[5] || '';
                            const tagStr = region && exp ? `[${region},${exp}]` : '';
                            const isCdrLoop = region === 'CDR-Loop' || region === 'CDR';
                            const isFrLoop = region === 'FR-Loop';
                            const isLoop = includeFrLoops ? (isCdrLoop || isFrLoop) : isCdrLoop;
                            const isExp = exp === 'Exp';
                            const isLoopExp = isLoop && isExp;

                            const isGlycMotif = header.includes('NGlycSites');
                            const isHighMotif = (motif === 'NG' || motif === 'DG') && isLoopExp;
                            const isModMotif =
                              ['M', 'W', 'NS', 'NT', 'NN', 'NH', 'DS', 'DD'].includes(motif) && isLoopExp;
                            const isLowMotif =
                              ((motif.startsWith('N') &&
                                motif.length === 2 &&
                                !['NG', 'NS', 'NT', 'NN', 'NH'].includes(motif)) ||
                                (motif.startsWith('D') &&
                                  motif.length === 2 &&
                                  !['DG', 'DS', 'DD'].includes(motif))) &&
                              isLoopExp;

                            let tagColorClass = 'text-surface-400';
                            let coreColorClass = 'text-surface-500';
                            if (isGlycMotif || isHighMotif) {
                              coreColorClass = 'text-rose-700 font-bold';
                              tagColorClass = 'text-rose-600 font-bold';
                            } else if (isModMotif) {
                              coreColorClass = 'text-amber-900 font-bold';
                              tagColorClass = 'text-amber-700 font-semibold';
                            } else if (isLowMotif) {
                              coreColorClass = 'text-emerald-800 font-semibold';
                              tagColorClass = 'text-emerald-600 font-medium';
                            }

                            return (
                              <span key={tIdx} className="inline-flex items-baseline">
                                <span className={coreColorClass}>
                                  {linearPart}
                                  {imgtPart && <span className="text-[10px] opacity-80">{imgtPart}</span>}
                                  {motifPart}
                                </span>
                                {tagStr && <span className={`text-[10px] ${tagColorClass}`}>{tagStr}</span>}
                                {tIdx < tokens.length - 1 && <span className="text-surface-400 mr-0.5">,</span>}
                              </span>
                            );
                          })}
                        </div>
                      );
                    };

                    return (
                      <td
                        key={cIdx}
                        className={`px-4 py-2.5 text-surface-700 whitespace-nowrap align-top ${
                          isFirst
                            ? 'sticky left-0 bg-white group-hover:bg-surface-50 shadow-[1px_0_0_0_#f1f5f9] z-10 font-medium text-surface-900 transition-colors'
                            : ''
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          {renderCellContent()}
                          {flagDot}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-surface-50 rounded-2xl shadow-2xl w-full max-w-[94vw] max-h-[92vh] flex flex-col overflow-hidden border border-surface-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-surface-200 flex flex-wrap items-center justify-between gap-4 bg-white z-20">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center border border-brand-100">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-surface-900 tracking-tight font-display">Analysis Results</h2>
                <span className="text-xs font-mono font-semibold text-surface-700 bg-surface-100 px-2 py-0.5 rounded border border-surface-200">
                  {batchId}
                </span>
                {activeFilterCount > 0 && (
                  <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> {activeFilterCount} Cohort Filters Synced
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-500 mt-0.5">
                Hover over <span className="font-mono font-bold">?</span> in column headers for parameter formulas & 4-Tier PTM rules
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-xs"
            >
              <Sheet className="w-4 h-4" />
              Export Excel (.xlsx)
            </button>
            <a
              href={`/api/jobs/${batchId}/download?type=results&remoteBasePath=${encodeURIComponent(remoteBasePath)}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-surface-200 hover:bg-surface-50 text-surface-700 rounded-lg text-xs font-semibold transition-all shadow-xs"
              title="Download raw files (CSV + PDBs)"
            >
              <Download className="w-4 h-4 text-brand-600" />
              Raw (.tar.gz)
            </a>
            <button
              onClick={onClose}
              className="p-2 bg-surface-100 hover:bg-surface-200 text-surface-600 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Column Group Bar */}
        {!loading && !error && (tapData.length > 1 || tnpData.length > 1) && (
          <div className="px-6 py-3 bg-white border-b border-surface-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-lg border border-surface-200">
                {([
                  { id: 'ALL', label: 'All Columns' },
                  { id: '3D', label: '3D Structural' },
                  { id: 'VHVL', label: 'VH+VL (Fv)' },
                  { id: 'VH', label: 'VH / VHH' },
                  { id: 'VL', label: 'VL' },
                  { id: 'PTM', label: '4-Tier PTM Risks' }
                ] as { id: ColumnGroupFilter; label: string }[]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setColGroup(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      colGroup === tab.id
                        ? 'bg-white text-surface-900 shadow-xs'
                        : 'text-surface-600 hover:text-surface-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-lg border border-surface-200">
                <span className="text-[11px] font-semibold text-surface-500 px-2">PTM Loop Scope:</span>
                <button
                  onClick={() => setIncludeFrLoops(false)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    !includeFrLoops
                      ? 'bg-surface-900 text-white shadow-xs'
                      : 'text-surface-600 hover:text-surface-900'
                  }`}
                >
                  CDR-Loop Only
                </button>
                <button
                  onClick={() => setIncludeFrLoops(true)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    includeFrLoops
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-surface-600 hover:text-surface-900'
                  }`}
                >
                  + FR-Loop
                </button>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter by target name..."
                className="w-full pl-8 pr-3 py-1.5 bg-surface-50 border border-surface-200 rounded-lg text-xs font-mono focus:bg-white focus:border-brand-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-surface-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[360px]">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
              <p className="mt-3 text-xs font-medium text-surface-600">Loading profiling data and reference percentiles...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl flex flex-col items-center justify-center text-center max-w-lg mx-auto mt-10">
              <AlertTriangle className="w-6 h-6 text-rose-600 mb-2" />
              <h3 className="text-base font-bold text-rose-900 mb-1">Failed to load results</h3>
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          ) : (
            <div>
              {tapData.length <= 1 && tnpData.length <= 1 && (
                <div className="p-10 bg-white border border-surface-200 rounded-xl flex flex-col items-center justify-center text-center">
                  <AlertTriangle className="w-7 h-7 text-amber-500 mb-3" />
                  <h3 className="text-base font-bold text-surface-800 mb-1">No Analysis Data Available</h3>
                  <p className="text-xs text-surface-500 max-w-md">
                    The job might still be running or has not generated CSV results yet.
                  </p>
                </div>
              )}
              {renderTable(tapData, 'TAP 2024 Profiling · mAb (VH+VL)', '3D CDR patch metrics + VH, VL, and paired VH+VL (Fv) sequence & PTM evaluation')}
              {renderTable(tnpData, 'TNP 2025 Profiling · Nanobody (VHH)', '3D CDR3 compactness & patch metrics + VHH sequence & PTM evaluation')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
