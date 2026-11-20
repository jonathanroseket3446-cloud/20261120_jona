import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

function percentile(N: number[], percent: number) {
    if (!N || N.length === 0) return null;
    N.sort((a, b) => a - b);
    const k = (N.length - 1) * percent;
    const f = Math.floor(k);
    const c = Math.ceil(k);
    if (f === c) return N[k];
    const d0 = N[f] * (c - k);
    const d1 = N[c] * (k - f);
    return Math.round((d0 + d1) * 100000) / 100000;
}

function calcThresholds(values: number[]) {
    const valid = values.filter(v => v !== null && !isNaN(v)).sort((a, b) => a - b);
    if (valid.length === 0) return { count: 0 };
    return {
        p0: Math.round(percentile(valid, 0.0)! * 100) / 100,
        p5: Math.round(percentile(valid, 0.05)! * 100) / 100,
        p10: Math.round(percentile(valid, 0.10)! * 100) / 100,
        p25: Math.round(percentile(valid, 0.25)! * 100) / 100,
        p50: Math.round(percentile(valid, 0.50)! * 100) / 100,
        p75: Math.round(percentile(valid, 0.75)! * 100) / 100,
        p90: Math.round(percentile(valid, 0.90)! * 100) / 100,
        p95: Math.round(percentile(valid, 0.95)! * 100) / 100,
        p100: Math.round(percentile(valid, 1.00)! * 100) / 100,
        count: valid.length,
        raw_data: valid.map(v => Math.round(v * 100) / 100)
    };
}

let cachedTapData: any[] | null = null;
let cachedTnpData: any[] | null = null;
let allTapStagesCache: string[] = [];
let allTnpStagesCache: string[] = [];
let allTapYearsCache: string[] = [];
let allTnpYearsCache: string[] = [];
let allTapTargetsCache: string[] = [];
let allTnpTargetsCache: string[] = [];
let allTapGeneticsCache: string[] = [];
let allTnpGeneticsCache: string[] = [];

// Bjellqvist et al. pKa scale (matches Biopython Bio.SeqUtils.IsoelectricPoint)
const POS_PK: Record<string, number> = { K: 10.0, R: 12.0, H: 5.98 };
const NEG_PK: Record<string, number> = { D: 4.05, E: 4.45, C: 9.0, Y: 10.0 };
const N_TERM_PK: Record<string, number> = { A: 7.59, M: 7.0, S: 6.93, P: 8.36, T: 6.82, V: 7.44, E: 7.7 };
const C_TERM_PK: Record<string, number> = { D: 4.55, E: 4.75 };

function chainChargeAtPH(seq: string, pH: number): number {
    const clean = (seq || '').trim().toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, '');
    if (!clean) return 0;

    const nTermPk = N_TERM_PK[clean[0]] ?? 7.5;
    const cTermPk = C_TERM_PK[clean[clean.length - 1]] ?? 3.55;

    let posCharge = 1.0 / (1.0 + Math.pow(10, pH - nTermPk));
    let negCharge = 1.0 / (1.0 + Math.pow(10, cTermPk - pH));

    const counts: Record<string, number> = {};
    for (let i = 0; i < clean.length; i++) {
        const aa = clean[i];
        counts[aa] = (counts[aa] || 0) + 1;
    }

    for (const [aa, pK] of Object.entries(POS_PK)) {
        if (counts[aa]) {
            posCharge += counts[aa] / (1.0 + Math.pow(10, pH - pK));
        }
    }
    for (const [aa, pK] of Object.entries(NEG_PK)) {
        if (counts[aa]) {
            negCharge += counts[aa] / (1.0 + Math.pow(10, pK - pH));
        }
    }

    return posCharge - negCharge;
}

export function calcTwoChainPI(seqH: string, seqL: string): number {
    let minPH = 1.0;
    let maxPH = 14.0;
    for (let i = 0; i < 25; i++) {
        const mid = (minPH + maxPH) / 2.0;
        const netCharge = chainChargeAtPH(seqH, mid) + chainChargeAtPH(seqL, mid);
        if (netCharge > 0) {
            minPH = mid;
        } else {
            maxPH = mid;
        }
    }
    return Math.round(((minPH + maxPH) / 2.0) * 100) / 100;
}

function getSubRegionFromImgt(imgtNum: number): 'CDR1' | 'CDR2' | 'CDR3' | 'FR1' | 'FR2' | 'FR3' | 'FR4' {
    if (imgtNum >= 27 && imgtNum <= 38) return 'CDR1';
    if (imgtNum >= 56 && imgtNum <= 65) return 'CDR2';
    if (imgtNum >= 105 && imgtNum <= 117) return 'CDR3';
    if (imgtNum < 27) return 'FR1';
    if (imgtNum < 56) return 'FR2';
    if (imgtNum < 105) return 'FR3';
    return 'FR4';
}

function assignImgtTokensFromSeq(seq: string, chainType: 'VH' | 'VL' | 'VHH'): Array<{ imgtNum: number; imgtLabel: string }> {
    const clean = (seq || '').trim().toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, '');
    const n = clean.length;
    if (n === 0) return [];
    const isVL = chainType === 'VL';

    const cPositions: number[] = [];
    const wPositions: number[] = [];
    for (let i = 0; i < n; i++) {
        if (clean[i] === 'C') cPositions.push(i + 1);
        if (clean[i] === 'W') wPositions.push(i + 1);
    }

    const c1 = cPositions.find(p => p >= 18 && p <= 26) ?? (isVL ? 23 : 22);
    const c2 = [...cPositions].reverse().find(p => p >= 80 && p <= 106) ?? (isVL ? 88 : 96);

    const startSlice = Math.max(0, c1 + 8);
    const sliceFr2 = clean.slice(startSlice, c1 + 23);
    const fr2Match = sliceFr2.search(/W[VFIYHL][RKQ][QKP]/);
    const wFr2 = fr2Match !== -1
        ? (startSlice + fr2Match + 1)
        : (wPositions.find(p => p >= c1 + 9 && p <= c1 + 20) ?? (isVL ? 35 : 36));

    const tailAfterC2 = clean.slice(c2);
    const fr4Idx = tailAfterC2.search(/W[GSA][QKR]G|F[GSA][QKRGT]G/);
    const jStart = fr4Idx !== -1 ? (c2 + fr4Idx + 1) : (isVL ? c2 + 11 : c2 + 13);

    const fr3Len = isVL ? 32 : 38;
    const fr3Start = Math.max(wFr2 + 16, c2 - fr3Len + 1);

    const result: Array<{ imgtNum: number; imgtLabel: string }> = [];

    for (let pos = 1; pos <= n; pos++) {
        let num = pos;
        let label = String(pos);
        if (pos <= c1 + 3) {
            if (pos === c1) num = 23;
            else if (pos > c1) num = 23 + (pos - c1);
            else num = (c1 === 22 && pos >= 10) ? (pos + 1) : Math.max(1, 23 - (c1 - pos));
            label = String(num);
        } else if (pos <= wFr2 - 3) {
            const cdr1S = c1 + 4;
            const cdr1E = wFr2 - 3;
            const l1 = Math.max(1, cdr1E - cdr1S + 1);
            const idx = pos - cdr1S;
            const leftN = Math.floor((l1 + 1) / 2);
            if (l1 <= 12) {
                num = idx < leftN ? (27 + idx) : (38 - (l1 - 1 - idx));
                label = String(num);
            } else if (idx < 6) {
                num = 27 + idx;
                label = String(num);
            } else if (idx >= l1 - 6) {
                num = 38 - (l1 - 1 - idx);
                label = String(num);
            } else {
                num = 33;
                label = `33${String.fromCharCode(65 + Math.min(25, idx - 6))}`;
            }
        } else if (pos <= wFr2 + 14) {
            num = 39 + (pos - (wFr2 - 2));
            label = String(num);
        } else if (pos < fr3Start) {
            const cdr2S = wFr2 + 15;
            const cdr2E = fr3Start - 1;
            const l2 = Math.max(1, cdr2E - cdr2S + 1);
            const idx = pos - cdr2S;
            const leftN = Math.floor((l2 + 1) / 2);
            if (l2 <= 10) {
                num = idx < leftN ? (56 + idx) : (65 - (l2 - 1 - idx));
                label = String(num);
            } else if (idx < 5) {
                num = 56 + idx;
                label = String(num);
            } else if (idx >= l2 - 5) {
                num = 65 - (l2 - 1 - idx);
                label = String(num);
            } else {
                num = 60;
                label = `60${String.fromCharCode(65 + Math.min(25, idx - 5))}`;
            }
        } else if (pos <= c2) {
            if (pos === c2) {
                num = 104;
            } else if (!isVL) {
                const distToC2 = c2 - pos;
                if (distToC2 <= 30) {
                    num = 104 - distToC2;
                } else {
                    const offset = pos - fr3Start;
                    num = Math.min(73, 66 + offset);
                }
            } else {
                const distToC2 = c2 - pos;
                if (distToC2 <= 18) {
                    num = 104 - distToC2;
                } else {
                    const offset = pos - fr3Start;
                    if (offset < 3) num = 66 + offset;
                    else if (offset < 9) num = 71 + (offset - 3);
                    else num = Math.min(85, 78 + (offset - 9));
                }
            }
            label = String(num);
        } else if (pos < jStart) {
            const cdr3S = c2 + 1;
            const cdr3E = jStart - 1;
            const l3 = Math.max(1, cdr3E - cdr3S + 1);
            const idx = pos - cdr3S;
            if (l3 <= 13) {
                const leftN = Math.floor((l3 + 1) / 2);
                num = idx < leftN ? (105 + idx) : (117 - (l3 - 1 - idx));
                label = String(num);
            } else if (idx < 7) {
                num = 105 + idx;
                label = String(num);
            } else if (idx >= l3 - 6) {
                num = 117 - (l3 - 1 - idx);
                label = String(num);
            } else {
                num = 111;
                label = `111${String.fromCharCode(65 + Math.min(25, idx - 7))}`;
            }
        } else {
            num = 118 + (pos - jStart);
            label = String(num);
        }
        result.push({ imgtNum: num, imgtLabel: label });
    }
    return result;
}

function isImgtLoop(imgtNum: number): boolean {
    const isCdrTrueLoop =
        (imgtNum >= 27 && imgtNum <= 36) ||
        (imgtNum >= 57 && imgtNum <= 64) ||
        (imgtNum >= 107 && imgtNum <= 115);
    const isFrTrueLoop =
        (imgtNum >= 14 && imgtNum <= 17) ||
        (imgtNum >= 44 && imgtNum <= 47) ||
        (imgtNum >= 71 && imgtNum <= 74) ||
        (imgtNum >= 82 && imgtNum <= 85) ||
        (imgtNum >= 95 && imgtNum <= 97);
    return isCdrTrueLoop || isFrTrueLoop;
}

function getConservedImgtNote(chain: string, imgtNum: number, motif: string, subRegion: string, tier: string): string {
    if (motif === 'W' && imgtNum === 38) return 'Conserved CDR1 C-terminal beta-stem anchor Trp (IMGT W38)';
    if (motif === 'W' && imgtNum === 41) return 'Conserved FR2 C-strand hydrophobic core Trp (IMGT W41)';
    if (chain !== 'VL' && motif === 'W' && imgtNum === 52) return 'Conserved VH/VL interface FR2 C\'-strand Trp (IMGT W52)';
    if (motif === 'W' && imgtNum === 118) return 'Conserved FR4 G-strand WGQG anchor Trp (IMGT W118)';
    if (motif === 'M' && (imgtNum === 37 || imgtNum === 38)) return 'Conserved CDR1 C-terminal beta-stem Met (IMGT M37/M38)';
    if (motif === 'M' && imgtNum === 39) return 'Conserved FR2 C-strand buried anchor Met (IMGT M39)';
    if (chain !== 'VL' && motif === 'M' && imgtNum === 53) return 'Buried FR2 Vernier anchor preceding CDR-H2 (IMGT M53)';
    if (chain !== 'VL' && motif === 'M' && (imgtNum >= 89 && imgtNum <= 92)) return 'Buried FR3 E-strand hydrophobic core Met (IMGT M91)';
    if (chain !== 'VL' && motif === 'DS' && (imgtNum >= 68 && imgtNum <= 70)) return 'Human IGHV3 FR3 C\'\'-strand motif (...YADSVKG..., IMGT 69)';
    if (chain !== 'VL' && (motif === 'NS' || motif === 'NT') && (imgtNum >= 82 && imgtNum <= 85)) return 'Human IGHV3 FR3 DE-turn (HV4) (...RDNSKNT..., IMGT 82-85)';
    if (chain !== 'VL' && motif === 'NS' && (imgtNum >= 91 && imgtNum <= 94)) return 'Human IGHV3 FR3 E-strand motif (...QMNSLRA..., IMGT 92)';
    if (chain === 'VL' && motif === 'M' && imgtNum === 4) return 'Conserved FR1 A-strand core Met (IMGT M4)';
    if (chain === 'VL' && motif === 'M' && (imgtNum >= 99 && imgtNum <= 103)) return 'Buried FR3 F-strand core Met preceding Cys104';
    if (tier === 'Low') return `${subRegion} exposed loop slow Nx/Dx motif (Tier 4 Low Risk)`;
    if (tier === 'Protected') return `${subRegion} structurally protected (beta-strand / buried) residue`;
    return `${subRegion} surface-exposed loop liability`;
}

export type SiteRiskTier = 'Intolerable' | 'High' | 'Moderate' | 'Low' | 'Protected';

const CORE_DEAM_MOTIFS = new Set(['NG', 'NS', 'NT', 'NN', 'NH']);
const CORE_ISOM_MOTIFS = new Set(['DG', 'DS', 'DD']);

function evaluateSiteTier(
    motif: string,
    regionTag: string,
    exp: 'Exp' | 'Buried',
    category: string,
    includeFrLoops: boolean = false
): SiteRiskTier {
    if (category === 'N-Glycosylation' || /^N[^P][ST]$/.test(motif)) {
        return 'Intolerable';
    }
    const isCdrLoop = regionTag === 'CDR-Loop' || regionTag === 'CDR';
    const isFrLoop = regionTag === 'FR-Loop';
    const isLoop = includeFrLoops ? (isCdrLoop || isFrLoop) : isCdrLoop;
    const isExp = exp === 'Exp';

    // Tier 2 High Risk: NG & DG; exposed & in loops
    if ((motif === 'NG' || motif === 'DG') && isLoop && isExp) {
        return 'High';
    }
    // Tier 3 Moderate Risk: M, W, NS, NT, NN, NH, DS, DD; exposed & in loops
    if (
        ['M', 'W', 'NS', 'NT', 'NN', 'NH', 'DS', 'DD'].includes(motif) &&
        isLoop &&
        isExp
    ) {
        return 'Moderate';
    }
    // Tier 4 Low Risk: Other Nx (including NP) & Other Dx (including DP, DT, DH) not mentioned above; exposed & in loops
    const isOtherNx = motif.length === 2 && motif.startsWith('N') && !CORE_DEAM_MOTIFS.has(motif);
    const isOtherDx = motif.length === 2 && motif.startsWith('D') && !CORE_ISOM_MOTIFS.has(motif);
    if ((isOtherNx || isOtherDx) && isLoop && isExp) {
        return 'Low';
    }
    return 'Protected';
}

function splitBracketSafe(valStr: string): string[] {
    if (!valStr || valStr.trim() === '' || valStr.trim() === 'None') return [];
    return valStr
        .split(/,\s*(?![^\[\]]*\])/)
        .map(s => s.trim())
        .filter(s => s && s !== 'None');
}

function computeChainLiabilityStatsCore(
    rows: any[],
    chainKey: 'VH' | 'VL' | 'VHVL' | 'VHH',
    includeFrLoops: boolean = false
) {
    const total = rows.length;
    if (total === 0) {
        return {
            total: 0,
            includeFrLoops,
            tierSummary: {
                intolerableCount: 0,
                intolerablePercent: 0,
                freeCysCount: 0,
                freeCysPercent: 0,
                nGlycCount: 0,
                nGlycPercent: 0,
                highRiskCount: 0,
                highRiskPercent: 0,
                highNgCount: 0,
                highNgPercent: 0,
                highDgCount: 0,
                highDgPercent: 0,
                moderateRiskCount: 0,
                moderateRiskPercent: 0,
                modExpMCount: 0,
                modLoopWCount: 0,
                modLoopDeamCount: 0,
                modLoopIsomCount: 0,
                lowRiskCount: 0,
                lowRiskPercent: 0,
                lowRiskOnlyCount: 0,
                lowRiskOnlyPercent: 0
            },
            motifSummary: [],
            cdrHotspots: [],
            frConservedSites: []
        };
    }

    let intolerableCount = 0;
    let freeCysCount = 0;
    let nGlycCount = 0;
    let highRiskCount = 0;
    let highNgCount = 0;
    let highDgCount = 0;
    let moderateRiskCount = 0;
    let modExpMCount = 0;
    let modLoopWCount = 0;
    let modLoopDeamCount = 0;
    let modLoopIsomCount = 0;
    let lowRiskCount = 0;
    let lowRiskOnlyCount = 0;

    const motifStats: Record<string, {
        motif: string;
        category: string;
        tierRule: string;
        cdrExpAntibodies: Set<number>;
        frBuriedAntibodies: Set<number>;
        totalOccurrences: number;
        cdrExpOccurrences: number;
    }> = {};

    const ensureMotif = (motif: string, category: string, tierRule: string) => {
        if (!motifStats[motif]) {
            motifStats[motif] = {
                motif,
                category,
                tierRule,
                cdrExpAntibodies: new Set(),
                frBuriedAntibodies: new Set(),
                totalOccurrences: 0,
                cdrExpOccurrences: 0
            };
        }
        return motifStats[motif];
    };

    const siteMap: Record<string, {
        key: string;
        chain: string;
        imgtPos: string;
        imgtNum: number;
        linearPositions: number[];
        motif: string;
        category: string;
        subRegion: string;
        tag: string;
        tier: SiteRiskTier;
        count: number;
        note: string;
    }> = {};

    const chainsToScan: Array<'VH' | 'VL' | 'VHH'> = chainKey === 'VHVL' ? ['VH', 'VL'] : [chainKey];

    rows.forEach((r, rowIdx) => {
        let hasIntolerable = false;
        let hasFreeCys = false;
        let hasNGlyc = false;
        let hasHigh = false;
        let hasHighNg = false;
        let hasHighDg = false;
        let hasMod = false;
        let hasModExpM = false;
        let hasModLoopW = false;
        let hasModLoopDeam = false;
        let hasModLoopIsom = false;
        let hasLow = false;

        // For Whole Fv (VHVL), check explicit VHVL_Cys 3D status first if present (handles inter-chain VH-VL ds-scFv disulfides)
        const vhvlCysCol = chainKey === 'VHVL' ? String(r['VHVL_Cys'] || r['VHVL_Cys_Value'] || '') : '';
        const vhvlHasExplicit3dCys = chainKey === 'VHVL' && (vhvlCysCol.includes('Free: Yes') || vhvlCysCol.includes('Free: No'));
        if (vhvlHasExplicit3dCys && vhvlCysCol.includes('Free: Yes')) {
            hasFreeCys = true;
            hasIntolerable = true;
            const ms = ensureMotif('Free Cys (C)', 'Free Cys', 'Intolerable (Free Cys)');
            ms.cdrExpAntibodies.add(rowIdx);
            ms.totalOccurrences++;
            ms.cdrExpOccurrences++;
        }

        for (const c of chainsToScan) {
            const seqCol = c === 'VHH' ? (r['VH'] || r['VHH'] || '') : (r[c] || '');
            const seq = String(seqCol).trim().toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, '');
            if (!vhvlHasExplicit3dCys) {
                const cysCol = String(r[`${c}_Cys`] || r[`${c}_Cys_Value`] || '');
                const has3dCys = cysCol.includes('Free: Yes') || cysCol.includes('Free: No');
                const isFreeCys = has3dCys
                    ? cysCol.includes('Free: Yes')
                    : (seq.length > 0 && (seq.split('C').length - 1) % 2 !== 0);
                if (isFreeCys) {
                    hasFreeCys = true;
                    hasIntolerable = true;
                    const ms = ensureMotif('Free Cys (C)', 'Free Cys', 'Intolerable (Free Cys)');
                    ms.cdrExpAntibodies.add(rowIdx);
                    ms.totalOccurrences++;
                    ms.cdrExpOccurrences++;
                }
            }

            const imgtTokens = seq ? assignImgtTokensFromSeq(seq, c) : [];

            // Legacy _Cleavage column (if present in uploaded user CSV) is parsed under Isomerization (Other Dx)
            const colDefs: Array<{ col: string; category: string }> = [
                { col: `${c}_NGlycSites`, category: 'N-Glycosylation' },
                { col: `${c}_Deamidation`, category: 'Deamidation' },
                { col: `${c}_Isomerization`, category: 'Isomerization' },
                { col: `${c}_Cleavage`, category: 'Isomerization' },
                { col: `${c}_Oxidation`, category: 'Oxidation' }
            ];

            for (const { col, category } of colDefs) {
                const rawVal = String(r[col] || r[`${col}_Value`] || '');
                const tokens = splitBracketSafe(rawVal);

                for (const tok of tokens) {
                    const m = tok.match(/^(?:(VH|VL|VHH):)?(\d+)(?:@IMGT([0-9A-Za-z]+))?\(([A-Z]+)\)(?:\[([A-Za-z-]+),([A-Za-z]+)\])?$/);
                    if (!m) continue;
                    const linearPos = parseInt(m[2], 10);
                    let imgtLabel = m[3] || '';
                    let imgtNum = imgtLabel ? parseInt(imgtLabel, 10) : 0;
                    const motif = m[4];
                    let regionTag = m[5] || '';
                    let exp = (m[6] as 'Exp' | 'Buried') || 'Exp';

                    if (!imgtLabel) {
                        if (linearPos >= 1 && linearPos <= imgtTokens.length) {
                            imgtNum = imgtTokens[linearPos - 1].imgtNum;
                            imgtLabel = imgtTokens[linearPos - 1].imgtLabel;
                        } else {
                            imgtNum = linearPos;
                            imgtLabel = String(linearPos);
                        }
                    }
                    if (!regionTag || !m[6]) {
                        const isCdr = (imgtNum >= 27 && imgtNum <= 38) || (imgtNum >= 56 && imgtNum <= 65) || (imgtNum >= 105 && imgtNum <= 117);
                        const isLoop = isImgtLoop(imgtNum);
                        regionTag = `${isCdr ? 'CDR' : 'FR'}-${isLoop ? 'Loop' : 'Strand'}`;
                        if (motif === 'W' && (!isLoop || [38, 41, 52, 118].includes(imgtNum))) exp = 'Buried';
                        else if (motif === 'M' && [4, 21, 34, 37, 38, 39, 53, 78, 89, 91, 92, 100, 101, 102, 115, 116].includes(imgtNum)) exp = 'Buried';
                        else if ([4, 6, 19, 21, 23, 25, 37, 38, 39, 40, 41, 52, 53, 55, 75, 76, 78, 80, 81, 86, 87, 89, 91, 92, 98, 100, 102, 104, 105, 116, 117, 118].includes(imgtNum)) exp = 'Buried';
                        else exp = 'Exp';
                    } else if (regionTag === 'CDR' || regionTag === 'FR') {
                        const isLoop = isImgtLoop(imgtNum);
                        regionTag = `${regionTag}-${isLoop ? 'Loop' : 'Strand'}`;
                    }

                    const subRegion = getSubRegionFromImgt(imgtNum);
                    const tag = `${regionTag},${exp}`;
                    const tier = evaluateSiteTier(motif, regionTag, exp, category, includeFrLoops);

                    const isOtherNx = motif.length === 2 && motif.startsWith('N') && !CORE_DEAM_MOTIFS.has(motif);
                    const isOtherDx = motif.length === 2 && motif.startsWith('D') && !CORE_ISOM_MOTIFS.has(motif);

                    const motifKey = category === 'N-Glycosylation'
                        ? 'Nx[ST]'
                        : isOtherNx
                        ? 'Other Nx'
                        : isOtherDx
                        ? 'Other Dx'
                        : motif;

                    const tierRule = category === 'N-Glycosylation'
                        ? 'Intolerable (Nx[ST])'
                        : (motif === 'NG' || motif === 'DG')
                        ? 'High (Loop,Exp)'
                        : (isOtherNx || isOtherDx)
                        ? 'Low (Loop,Exp)'
                        : 'Moderate (Loop,Exp)';

                    const ms = ensureMotif(motifKey, category, tierRule);
                    ms.totalOccurrences++;

                    if (tier === 'Intolerable') {
                        hasNGlyc = true;
                        hasIntolerable = true;
                        ms.cdrExpAntibodies.add(rowIdx);
                        ms.cdrExpOccurrences++;
                    } else if (tier === 'High') {
                        hasHigh = true;
                        if (motif === 'NG') hasHighNg = true;
                        if (motif === 'DG') hasHighDg = true;
                        ms.cdrExpAntibodies.add(rowIdx);
                        ms.cdrExpOccurrences++;
                    } else if (tier === 'Moderate') {
                        hasMod = true;
                        if (motif === 'M') hasModExpM = true;
                        else if (motif === 'W') hasModLoopW = true;
                        else if (category === 'Deamidation') hasModLoopDeam = true;
                        else hasModLoopIsom = true;
                        ms.cdrExpAntibodies.add(rowIdx);
                        ms.cdrExpOccurrences++;
                    } else if (tier === 'Low') {
                        hasLow = true;
                        ms.cdrExpAntibodies.add(rowIdx);
                        ms.cdrExpOccurrences++;
                    } else {
                        ms.frBuriedAntibodies.add(rowIdx);
                    }

                    const sKey = `${c}:IMGT${imgtLabel}(${motif})[${tag}]`;
                    if (!siteMap[sKey]) {
                        siteMap[sKey] = {
                            key: sKey,
                            chain: c,
                            imgtPos: `IMGT ${imgtLabel}`,
                            imgtNum,
                            linearPositions: [],
                            motif,
                            category,
                            subRegion,
                            tag,
                            tier,
                            count: 0,
                            note: getConservedImgtNote(c, imgtNum, motif, subRegion, tier)
                        };
                    }
                    siteMap[sKey].count++;
                    siteMap[sKey].linearPositions.push(linearPos);
                }
            }
        }

        if (hasIntolerable) intolerableCount++;
        if (hasFreeCys) freeCysCount++;
        if (hasNGlyc) nGlycCount++;
        if (hasHigh) highRiskCount++;
        if (hasHighNg) highNgCount++;
        if (hasHighDg) highDgCount++;
        if (hasMod) moderateRiskCount++;
        if (hasModExpM) modExpMCount++;
        if (hasModLoopW) modLoopWCount++;
        if (hasModLoopDeam) modLoopDeamCount++;
        if (hasModLoopIsom) modLoopIsomCount++;
        if (hasLow) lowRiskCount++;
        if (!hasIntolerable && !hasHigh && !hasMod) lowRiskOnlyCount++;
    });

    const motifOrder = ['Free Cys (C)', 'Nx[ST]', 'NG', 'DG', 'M', 'W', 'NS', 'NT', 'NN', 'NH', 'DS', 'DD', 'Other Nx', 'Other Dx'];
    const motifSummary = motifOrder
        .filter(k => motifStats[k])
        .map(k => {
            const st = motifStats[k];
            return {
                motif: st.motif,
                category: st.category,
                tierRule: st.tierRule,
                activeAntibodyCount: st.cdrExpAntibodies.size,
                activePercent: Math.round((st.cdrExpAntibodies.size / total) * 1000) / 10,
                conservedAntibodyCount: st.frBuriedAntibodies.size,
                conservedPercent: Math.round((st.frBuriedAntibodies.size / total) * 1000) / 10,
                totalOccurrences: st.totalOccurrences,
                activeOccurrences: st.cdrExpOccurrences
            };
        });

    const allSites = Object.values(siteMap).map(s => {
        const sortedLin = [...s.linearPositions].sort((a, b) => a - b);
        const minLin = sortedLin[0] ?? s.imgtNum;
        const maxLin = sortedLin[sortedLin.length - 1] ?? s.imgtNum;
        const medianLin = sortedLin[Math.floor(sortedLin.length / 2)] ?? s.imgtNum;
        const linearRangeStr = minLin === maxLin ? `${minLin}` : `${minLin}–${maxLin} (med ${medianLin})`;
        return {
            key: s.key,
            chain: s.chain,
            pos: s.imgtNum,
            imgtPos: s.imgtPos,
            linearRange: linearRangeStr,
            motif: s.motif,
            category: s.category,
            subRegion: s.subRegion,
            tag: s.tag,
            tier: s.tier,
            count: s.count,
            percent: Math.round((s.count / total) * 1000) / 10,
            note: s.note
        };
    });

    const cdrHotspots = allSites
        .filter(s => s.tier === 'Intolerable' || s.tier === 'High' || s.tier === 'Moderate')
        .sort((a, b) => {
            const tierWeight: Record<string, number> = { Intolerable: 5, High: 4, Moderate: 3, Low: 2, Protected: 1 };
            if (b.count !== a.count) return b.count - a.count;
            return (tierWeight[b.tier] || 0) - (tierWeight[a.tier] || 0);
        })
        .slice(0, 14);

    const frConservedSites = allSites
        .filter(s => s.tier === 'Protected')
        .sort((a, b) => b.count - a.count)
        .slice(0, 14);

    return {
        total,
        includeFrLoops,
        tierSummary: {
            intolerableCount,
            intolerablePercent: Math.round((intolerableCount / total) * 1000) / 10,
            freeCysCount,
            freeCysPercent: Math.round((freeCysCount / total) * 1000) / 10,
            nGlycCount,
            nGlycPercent: Math.round((nGlycCount / total) * 1000) / 10,
            highRiskCount,
            highRiskPercent: Math.round((highRiskCount / total) * 1000) / 10,
            highNgCount,
            highNgPercent: Math.round((highNgCount / total) * 1000) / 10,
            highDgCount,
            highDgPercent: Math.round((highDgCount / total) * 1000) / 10,
            moderateRiskCount,
            moderateRiskPercent: Math.round((moderateRiskCount / total) * 1000) / 10,
            modExpMCount,
            modLoopWCount,
            modLoopDeamCount,
            modLoopIsomCount,
            lowRiskCount,
            lowRiskPercent: Math.round((lowRiskCount / total) * 1000) / 10,
            lowRiskOnlyCount,
            lowRiskOnlyPercent: Math.round((lowRiskOnlyCount / total) * 1000) / 10
        },
        motifSummary,
        cdrHotspots,
        frConservedSites
    };
}

function computeChainLiabilityStats(rows: any[], chainKey: 'VH' | 'VL' | 'VHVL' | 'VHH') {
    const cdrOnlyStats = computeChainLiabilityStatsCore(rows, chainKey, false);
    const withFrLoopsStats = computeChainLiabilityStatsCore(rows, chainKey, true);
    return {
        ...cdrOnlyStats,
        withFrLoops: withFrLoopsStats
    };
}

export function computeGuidelines({
    tapStages = [],
    tnpStages = [],
    tapYears = [],
    tnpYears = [],
    tapTargets = [],
    tnpTargets = [],
    tapGenetics = [],
    tnpGenetics = []
}: {
    tapStages?: string[];
    tnpStages?: string[];
    tapYears?: string[];
    tnpYears?: string[];
    tapTargets?: string[];
    tnpTargets?: string[];
    tapGenetics?: string[];
    tnpGenetics?: string[];
}) {
    const customTapCsvPath = path.join(process.cwd(), 'uploads/custom_tap.csv');
    const customTnpCsvPath = path.join(process.cwd(), 'uploads/custom_tnp.csv');

    const tapCsvPath = fs.existsSync(customTapCsvPath) ? customTapCsvPath : path.join(process.cwd(), 'src/server/data/Analysis_Results_TAP.csv');
    const tnpCsvPath = fs.existsSync(customTnpCsvPath) ? customTnpCsvPath : path.join(process.cwd(), 'src/server/data/Analysis_Results_TNP.csv');

    if (fs.existsSync(tapCsvPath)) {
        cachedTapData = parse(fs.readFileSync(tapCsvPath, 'utf8').replace(/^\uFEFF/, ''), { columns: true, skip_empty_lines: true });
    } else {
        cachedTapData = [];
    }

    if (fs.existsSync(tnpCsvPath)) {
        cachedTnpData = parse(fs.readFileSync(tnpCsvPath, 'utf8').replace(/^\uFEFF/, ''), { columns: true, skip_empty_lines: true });
    } else {
        cachedTnpData = [];
    }

    const tapStageCol = "Highest_Clin_Trial";
    const tnpStageCol = "Highest_Clin_Trial";

    allTapStagesCache = Array.from(new Set(cachedTapData.map((r: any) => r[tapStageCol]))).filter(s => s && String(s).trim() !== '').sort();
    allTapYearsCache = Array.from(new Set(cachedTapData.map((r: any) => r['Year Proposed']))).filter(s => s && String(s).trim() !== '').sort();
    allTapTargetsCache = Array.from(new Set(cachedTapData.map((r: any) => r['Target']))).filter(s => s && String(s).trim() !== '').sort();
    allTapGeneticsCache = Array.from(new Set(cachedTapData.map((r: any) => r['Genetics']))).filter(s => s && String(s).trim() !== '').sort();

    allTnpStagesCache = Array.from(new Set(cachedTnpData.map((r: any) => r[tnpStageCol]))).filter(s => s && String(s).trim() !== '').sort();
    allTnpYearsCache = Array.from(new Set(cachedTnpData.map((r: any) => r['Year Proposed']))).filter(s => s && String(s).trim() !== '').sort();
    allTnpTargetsCache = Array.from(new Set(cachedTnpData.map((r: any) => r['Target']))).filter(s => s && String(s).trim() !== '').sort();
    allTnpGeneticsCache = Array.from(new Set(cachedTnpData.map((r: any) => r['Genetics']))).filter(s => s && String(s).trim() !== '').sort();

    let filteredTap = tapStages.length > 0 ? cachedTapData.filter(r => tapStages.includes(r[tapStageCol])) : cachedTapData;
    if (tapYears.length > 0) filteredTap = filteredTap.filter(r => tapYears.includes(String(r['Year Proposed'])));
    if (tapTargets.length > 0) filteredTap = filteredTap.filter(r => tapTargets.includes(String(r['Target'])));
    if (tapGenetics.length > 0) filteredTap = filteredTap.filter(r => tapGenetics.includes(String(r['Genetics'])));

    let filteredTnp = tnpStages.length > 0 ? cachedTnpData.filter(r => tnpStages.includes(r[tnpStageCol])) : cachedTnpData;
    if (tnpYears.length > 0) filteredTnp = filteredTnp.filter(r => tnpYears.includes(String(r['Year Proposed'])));
    if (tnpTargets.length > 0) filteredTnp = filteredTnp.filter(r => tnpTargets.includes(String(r['Target'])));
    if (tnpGenetics.length > 0) filteredTnp = filteredTnp.filter(r => tnpGenetics.includes(String(r['Genetics'])));

    const readCol = (data: any[], colName: string, altColName?: string) => {
        return data
            .map(r => parseFloat(r[colName] ?? (altColName ? r[altColName] : undefined)))
            .filter(v => !isNaN(v));
    };

    const vhvlMW: number[] = [];
    const vhvlPI: number[] = [];
    const vhvlGRAVY: number[] = [];
    const vhvlInstability: number[] = [];
    const vhvlCharge: number[] = [];
    const vhvlNGlyc: number[] = [];

    for (const r of filteredTap) {
        const lH = parseFloat(r['VH_Length']);
        const lL = parseFloat(r['VL_Length']);
        const mwH = parseFloat(r['VH_MW'] ?? r['VH_MW_Value']);
        const mwL = parseFloat(r['VL_MW'] ?? r['VL_MW_Value']);
        const gravyH = parseFloat(r['VH_GRAVY'] ?? r['VH_GRAVY_Value']);
        const gravyL = parseFloat(r['VL_GRAVY'] ?? r['VL_GRAVY_Value']);
        const instH = parseFloat(r['VH_Instability'] ?? r['VH_Instability_Value']);
        const instL = parseFloat(r['VL_Instability'] ?? r['VL_Instability_Value']);
        const chgH = parseFloat(r['VH_Charge'] ?? r['VH_Charge_Value']);
        const chgL = parseFloat(r['VL_Charge'] ?? r['VL_Charge_Value']);
        const ngH = parseFloat(r['VH_NGlyc']);
        const ngL = parseFloat(r['VL_NGlyc']);

        const directMW = parseFloat(r['VHVL_MW'] ?? r['VHVL_MW_Value']);
        if (!isNaN(directMW)) vhvlMW.push(directMW);
        else if (!isNaN(mwH) && !isNaN(mwL)) vhvlMW.push(Math.round((mwH + mwL) * 100) / 100);

        const directPI = parseFloat(r['VHVL_pI'] ?? r['VHVL_pI_Value']);
        if (!isNaN(directPI)) vhvlPI.push(directPI);
        else if (r['VH'] && r['VL']) vhvlPI.push(calcTwoChainPI(String(r['VH']), String(r['VL'])));

        const directGRAVY = parseFloat(r['VHVL_GRAVY'] ?? r['VHVL_GRAVY_Value']);
        if (!isNaN(directGRAVY)) vhvlGRAVY.push(directGRAVY);
        else if (!isNaN(gravyH) && !isNaN(gravyL) && !isNaN(lH) && !isNaN(lL) && (lH + lL) > 0) {
            vhvlGRAVY.push(Math.round(((lH * gravyH + lL * gravyL) / (lH + lL)) * 1000) / 1000);
        }

        const directInst = parseFloat(r['VHVL_Instability'] ?? r['VHVL_Instability_Value']);
        if (!isNaN(directInst)) vhvlInstability.push(directInst);
        else if (!isNaN(instH) && !isNaN(instL) && !isNaN(lH) && !isNaN(lL) && (lH + lL) > 0) {
            vhvlInstability.push(Math.round(((lH * instH + lL * instL) / (lH + lL)) * 100) / 100);
        }

        const directCharge = parseFloat(r['VHVL_Charge'] ?? r['VHVL_Charge_Value']);
        if (!isNaN(directCharge)) vhvlCharge.push(directCharge);
        else if (!isNaN(chgH) && !isNaN(chgL)) vhvlCharge.push(Math.round((chgH + chgL) * 100) / 100);

        const directNGlyc = parseFloat(r['VHVL_NGlyc']);
        if (!isNaN(directNGlyc)) vhvlNGlyc.push(directNGlyc);
        else if (!isNaN(ngH) && !isNaN(ngL)) vhvlNGlyc.push(ngH + ngL);
    }

    const tap = {
        L_tot: calcThresholds(readCol(filteredTap, 'Total CDR Length (L_tot)', 'L_tot_Value')),
        PSH: calcThresholds(readCol(filteredTap, 'PSH', 'PSH_Value')),
        PPC: calcThresholds(readCol(filteredTap, 'PPC', 'PPC_Value')),
        PNC: calcThresholds(readCol(filteredTap, 'PNC', 'PNC_Value')),
        SFvCSP: calcThresholds(readCol(filteredTap, 'SFvCSP', 'SFvCSP_Value'))
    };

    const tnp = {
        L: calcThresholds(readCol(filteredTnp, 'L', 'L_Value')),
        L3: calcThresholds(readCol(filteredTnp, 'L3', 'L3_Value')),
        C: calcThresholds(readCol(filteredTnp, 'C', 'C_Value')),
        PSH: calcThresholds(readCol(filteredTnp, 'PSH', 'PSH_Value')),
        PPC: calcThresholds(readCol(filteredTnp, 'PPC', 'PPC_Value')),
        PNC: calcThresholds(readCol(filteredTnp, 'PNC', 'PNC_Value'))
    };

    const therasabdab = {
        count_VHVL: filteredTap.length,
        count_VHH: filteredTnp.length,
        VHVL: {
            VH: {
                Mol_Weight: calcThresholds(readCol(filteredTap, 'VH_MW', 'VH_MW_Value')),
                pI: calcThresholds(readCol(filteredTap, 'VH_pI', 'VH_pI_Value')),
                GRAVY: calcThresholds(readCol(filteredTap, 'VH_GRAVY', 'VH_GRAVY_Value')),
                Instability: calcThresholds(readCol(filteredTap, 'VH_Instability', 'VH_Instability_Value')),
                "Charge_pH7.4": calcThresholds(readCol(filteredTap, 'VH_Charge', 'VH_Charge_Value')),
                N_Glyco_Count: calcThresholds(readCol(filteredTap, 'VH_NGlyc'))
            },
            VL: {
                Mol_Weight: calcThresholds(readCol(filteredTap, 'VL_MW', 'VL_MW_Value')),
                pI: calcThresholds(readCol(filteredTap, 'VL_pI', 'VL_pI_Value')),
                GRAVY: calcThresholds(readCol(filteredTap, 'VL_GRAVY', 'VL_GRAVY_Value')),
                Instability: calcThresholds(readCol(filteredTap, 'VL_Instability', 'VL_Instability_Value')),
                "Charge_pH7.4": calcThresholds(readCol(filteredTap, 'VL_Charge', 'VL_Charge_Value')),
                N_Glyco_Count: calcThresholds(readCol(filteredTap, 'VL_NGlyc'))
            },
            VHVL: {
                Mol_Weight: calcThresholds(vhvlMW),
                pI: calcThresholds(vhvlPI),
                GRAVY: calcThresholds(vhvlGRAVY),
                Instability: calcThresholds(vhvlInstability),
                "Charge_pH7.4": calcThresholds(vhvlCharge),
                N_Glyco_Count: calcThresholds(vhvlNGlyc)
            }
        },
        VHH: {
            VHH: {
                Mol_Weight: calcThresholds(readCol(filteredTnp, 'VHH_MW', 'VHH_MW_Value')),
                pI: calcThresholds(readCol(filteredTnp, 'VHH_pI', 'VHH_pI_Value')),
                GRAVY: calcThresholds(readCol(filteredTnp, 'VHH_GRAVY', 'VHH_GRAVY_Value')),
                Instability: calcThresholds(readCol(filteredTnp, 'VHH_Instability', 'VHH_Instability_Value')),
                "Charge_pH7.4": calcThresholds(readCol(filteredTnp, 'VHH_Charge', 'VHH_Charge_Value')),
                N_Glyco_Count: calcThresholds(readCol(filteredTnp, 'VHH_NGlyc'))
            }
        }
    };

    const tapGeneticsBreakdownMap: Record<string, number> = {};
    for (const r of filteredTap) {
        const g = String(r['Genetics'] || 'Unspecified').trim() || 'Unspecified';
        tapGeneticsBreakdownMap[g] = (tapGeneticsBreakdownMap[g] || 0) + 1;
    }
    const tapGeneticsBreakdown = Object.entries(tapGeneticsBreakdownMap)
        .map(([label, count]) => ({
            label,
            count,
            percent: filteredTap.length > 0 ? Math.round((count / filteredTap.length) * 1000) / 10 : 0
        }))
        .sort((a, b) => b.count - a.count);

    const tnpGeneticsBreakdownMap: Record<string, number> = {};
    for (const r of filteredTnp) {
        const g = String(r['Genetics'] || '').trim();
        if (g) tnpGeneticsBreakdownMap[g] = (tnpGeneticsBreakdownMap[g] || 0) + 1;
    }
    const tnpGeneticsBreakdown = Object.entries(tnpGeneticsBreakdownMap)
        .map(([label, count]) => ({
            label,
            count,
            percent: filteredTnp.length > 0 ? Math.round((count / filteredTnp.length) * 1000) / 10 : 0
        }))
        .sort((a, b) => b.count - a.count);

    const liabilityStats = {
        VH: computeChainLiabilityStats(filteredTap, 'VH'),
        VL: computeChainLiabilityStats(filteredTap, 'VL'),
        VHVL: computeChainLiabilityStats(filteredTap, 'VHVL'),
        VHH: computeChainLiabilityStats(filteredTnp, 'VHH')
    };

    return {
        tap,
        tnp,
        therasabdab,
        liabilityStats,
        tapGeneticsBreakdown,
        tnpGeneticsBreakdown,
        metadata: {
            availableTapStages: allTapStagesCache,
            availableTnpStages: allTnpStagesCache,
            availableTapYears: allTapYearsCache,
            availableTnpYears: allTnpYearsCache,
            availableTapTargets: allTapTargetsCache,
            availableTnpTargets: allTnpTargetsCache,
            availableTapGenetics: allTapGeneticsCache,
            availableTnpGenetics: allTnpGeneticsCache
        }
    };
}
