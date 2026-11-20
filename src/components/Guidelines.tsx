import { toPng } from "html-to-image";
import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Maximize2,
  X,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  Search
} from 'lucide-react';
import axios from 'axios';
import InfoTooltip, { resolveMetricMeta } from './InfoTooltip';
import {
  CohortFilters,
  loadCohortFilters,
  saveCohortFilters,
  buildGuidelinesSearchParams,
  countModalityFilters
} from '../utils/filterState';

const displayNames: Record<string, string> = {
  'L_tot': 'Total CDR Length (L_tot)',
  'L': 'Total CDR Length (L)',
  'L3': 'CDR3 Length (L3)',
  'C': 'CDR3 Compactness (C)',
  'PSH': 'Surface Hydrophobicity (PSH)',
  'PPC': 'Positive Charge Patches (PPC)',
  'PNC': 'Negative Charge Patches (PNC)',
  'SFvCSP': 'Fv Charge Symmetry (SFvCSP)',
  'Mol_Weight': 'Molecular Weight (MW)',
  'pI': 'Isoelectric Point (pI)',
  'GRAVY': 'GRAVY Hydropathy',
  'Instability': 'Instability Index (II)',
  'Charge_pH7.4': 'Net Charge (pH 7.4)',
  'N_Glyco_Count': 'N-Glycosylation Count'
};

const BoxScatterPlot = ({ data, thresholds, isEnlarged = false }: { data: number[], thresholds: any, isEnlarged?: boolean }) => {
  if (!data || data.length === 0) return null;

  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const isThera = thresholds.p0 !== undefined;
  const isTAPExtended = thresholds.red_low !== undefined && thresholds.green_25 !== undefined;

  const q1 = isThera ? thresholds.p25 : (isTAPExtended ? thresholds.green_25 : sorted[Math.floor(sorted.length * 0.25)]);
  const median = isThera ? thresholds.p50 : sorted[Math.floor(sorted.length * 0.5)];
  const q3 = isThera ? thresholds.p75 : (isTAPExtended ? thresholds.green_75 : sorted[Math.floor(sorted.length * 0.75)]);
  const iqr = Math.max(0, q3 - q1);

  const rawWhiskerMin = Math.max(min, q1 - 1.5 * iqr);
  const rawWhiskerMax = Math.min(max, q3 + 1.5 * iqr);

  // Compute a robust visual coordinate system so extreme single outliers (P0 / P100)
  // never squash the 5%–95% core distribution into a tiny sliver of the chart.
  const p5Val = isThera ? thresholds.p5 : (thresholds.red_low ?? min);
  const p95Val = isThera ? thresholds.p95 : (thresholds.red_high ?? thresholds.red ?? max);
  const coreSpan = Math.max(p95Val - p5Val, iqr * 1.4, (max - min) * 0.12, 0.4);

  const visP0 = isThera
    ? Math.max(thresholds.p0, p5Val - coreSpan * 0.26)
    : p5Val - coreSpan * 0.12;
  const visP100 = isThera
    ? Math.min(thresholds.p100, p95Val + coreSpan * 0.26)
    : p95Val + coreSpan * 0.12;

  const plotMin = visP0 - coreSpan * 0.07;
  const plotMax = visP100 + coreSpan * 0.07;
  const plotRange = Math.max(plotMax - plotMin, 1e-6);

  // Piecewise-linear mapping: preserves 100% linear scale across [p5, p95],
  // while smoothly mapping long tails [p0, p5] -> [visP0, p5] and [p95, p100] -> [p95, visP100]
  const mapValToVisual = (val: number): number => {
    if (!isThera) {
      return Math.max(plotMin, Math.min(plotMax, val));
    }
    if (val >= p5Val && val <= p95Val) {
      return val;
    }
    if (val < p5Val) {
      const actualLowSpan = p5Val - thresholds.p0;
      const visLowSpan = p5Val - visP0;
      if (actualLowSpan <= 1e-6 || visLowSpan <= 1e-6) {
        return Math.max(plotMin, val);
      }
      if (val >= thresholds.p0) {
        const t = (p5Val - val) / actualLowSpan;
        return p5Val - t * visLowSpan;
      }
      return Math.max(plotMin + coreSpan * 0.015, visP0 - ((thresholds.p0 - val) / actualLowSpan) * coreSpan * 0.05);
    } else {
      const actualHighSpan = thresholds.p100 - p95Val;
      const visHighSpan = visP100 - p95Val;
      if (actualHighSpan <= 1e-6 || visHighSpan <= 1e-6) {
        return Math.min(plotMax, val);
      }
      if (val <= thresholds.p100) {
        const t = (val - p95Val) / actualHighSpan;
        return p95Val + t * visHighSpan;
      }
      return Math.min(plotMax - coreSpan * 0.015, visP100 + ((val - thresholds.p100) / actualHighSpan) * coreSpan * 0.05);
    }
  };

  const getPct = (val: number): number => {
    const v = mapValToVisual(val);
    const clamped = Math.max(plotMin, Math.min(plotMax, v));
    return ((clamped - plotMin) / plotRange) * 100;
  };

  const getX = (val: number) => `${getPct(val).toFixed(2)}%`;

  const getWidth = (startVal: number, endVal: number) => {
    const sPct = startVal === -Infinity ? 0 : getPct(startVal);
    const ePct = endVal === Infinity ? 100 : getPct(endVal);
    if (ePct <= sPct) return '0%';
    return `${(ePct - sPct).toFixed(2)}%`;
  };

  const whiskerMin = Math.max(rawWhiskerMin, isThera ? thresholds.p0 : min);
  const whiskerMax = Math.min(rawWhiskerMax, isThera ? thresholds.p100 : max);

  // Sample points and compute a unified single-axis (y = 50%) Density-Aware Beeswarm
  const targetCount = isEnlarged ? 340 : 130;
  const step = Math.max(1, Math.floor(sorted.length / targetCount));
  const sampled = sorted.filter((_, i) => i % step === 0);

  const numBins = isEnlarged ? 40 : 26;
  const binCounts = new Array(numBins).fill(0);
  const pointBins = new Array(sampled.length).fill(0);

  sampled.forEach((val, idx) => {
    const pct = getPct(val);
    const b = Math.max(0, Math.min(numBins - 1, Math.floor((pct / 100) * numBins)));
    pointBins[idx] = b;
    binCounts[b]++;
  });

  const maxBinCount = Math.max(1, ...binCounts);
  const fract = (x: number) => x - Math.floor(x);

  const beeswarmPoints = sampled.map((val, idx) => {
    const b = pointBins[idx];
    const countInBin = binCounts[b];

    // Local violin/beeswarm envelope scaled by square-root of local density around y = 50%
    const densityRatio = Math.sqrt(countInBin / maxBinCount);
    const maxSpreadPct = isEnlarged ? 22.0 : 20.0;
    const localHalfSpread = (0.28 + 0.72 * densityRatio) * maxSpreadPct;

    // Two independent trigonometric hashes -> natural bell/triangular distribution in [-1, 1]
    // Completely eliminates diagonal stripes or staircase artifacts across sorted data
    const h1 = fract(Math.sin(idx * 127.1 + val * 311.7) * 43758.5453123);
    const h2 = fract(Math.sin(idx * 269.5 + val * 183.3 + 19.19) * 28461.312789);
    const bellOffset = countInBin <= 1 ? (h1 - 0.5) * 0.35 : (h1 + h2 - 1.0);
    const cyPct = 50 + bellOffset * localHalfSpread;

    // Subtle horizontal micro-jitter for tied / discrete values so they form a natural cluster
    const hX = fract(Math.sin(idx * 419.2 + val * 97.13) * 31415.9265);
    const xJitterPct = countInBin > 2 ? (hX - 0.5) * (isEnlarged ? 1.0 : 1.2) : 0;
    const cxPct = Math.max(1.2, Math.min(98.8, getPct(val) + xJitterPct));

    // Point color by developability zone
    let dotFill = 'rgba(30, 41, 59, 0.62)';
    if (isThera) {
      if (val < thresholds.p0 || val > thresholds.p100) dotFill = 'rgba(225, 29, 72, 0.82)';
      else if (val < thresholds.p5 || val > thresholds.p95) dotFill = 'rgba(217, 119, 6, 0.80)';
      else if (val >= thresholds.p25 && val <= thresholds.p75) dotFill = 'rgba(15, 23, 42, 0.68)';
      else dotFill = 'rgba(30, 41, 59, 0.58)';
    }

    return { cx: `${cxPct.toFixed(2)}%`, cy: `${cyPct.toFixed(2)}%`, fill: dotFill };
  });

  const strokeW = isEnlarged ? '2.4' : '1.5';
  const r = isEnlarged ? '2.5' : '1.5';
  const fontSize = isEnlarged ? '11' : '8';

  const q1Pct = getPct(q1);
  const q3Pct = getPct(q3);
  const boxWidthPct = Math.max(q3Pct - q1Pct, 1.2);
  const boxLeftPct = q3Pct - q1Pct < 1.2 ? q1Pct - 0.6 : q1Pct;
  const showSeparateQuartiles = Math.abs(q3Pct - q1Pct) >= 9;

  const p5Pct = getPct(p5Val);
  const p95Pct = getPct(p95Val);
  const showBothP5P95 = Math.abs(p95Pct - p5Pct) >= 12;

  const colors = {
    red: 'rgba(244, 63, 94, 0.16)',
    amber: 'rgba(251, 191, 36, 0.22)',
    greenLight: 'rgba(52, 211, 153, 0.14)',
    greenMid: 'rgba(52, 211, 153, 0.28)',
    greenDark: 'rgba(16, 185, 129, 0.40)'
  };

  return (
    <div className={`w-full relative select-none pointer-events-none flex flex-col justify-end ${isEnlarged ? 'h-40' : 'h-20'}`}>
      <svg className="w-full h-full overflow-hidden rounded-lg border border-surface-200" style={{ backgroundColor: '#ffffff' }}>
        {/* 1. Background Quantile Color Bands */}
        {isThera ? (
          <>
            <rect x="0%" width={getX(thresholds.p0)} height="100%" fill={colors.red} />
            <rect x={getX(thresholds.p0)} width={getWidth(thresholds.p0, thresholds.p5)} height="100%" fill={colors.amber} />
            <rect x={getX(thresholds.p5)} width={getWidth(thresholds.p5, thresholds.p10)} height="100%" fill={colors.greenLight} />
            <rect x={getX(thresholds.p10)} width={getWidth(thresholds.p10, thresholds.p25)} height="100%" fill={colors.greenMid} />
            <rect x={getX(thresholds.p25)} width={getWidth(thresholds.p25, thresholds.p75)} height="100%" fill={colors.greenDark} />
            <rect x={getX(thresholds.p75)} width={getWidth(thresholds.p75, thresholds.p90)} height="100%" fill={colors.greenMid} />
            <rect x={getX(thresholds.p90)} width={getWidth(thresholds.p90, thresholds.p95)} height="100%" fill={colors.greenLight} />
            <rect x={getX(thresholds.p95)} width={getWidth(thresholds.p95, thresholds.p100)} height="100%" fill={colors.amber} />
            <rect x={getX(thresholds.p100)} width={getWidth(thresholds.p100, Infinity)} height="100%" fill={colors.red} />
          </>
        ) : isTAPExtended ? (
          <>
            <rect x="0%" width={getX(thresholds.red_low)} height="100%" fill={colors.red} />
            <rect x={getX(thresholds.red_low)} width={getWidth(thresholds.red_low, thresholds.amber_low)} height="100%" fill={colors.amber} />
            <rect x={getX(thresholds.amber_low)} width={getWidth(thresholds.amber_low, thresholds.green_25)} height="100%" fill={colors.greenLight} />
            <rect x={getX(thresholds.green_25)} width={getWidth(thresholds.green_25, thresholds.green_75)} height="100%" fill={colors.greenDark} />
            <rect x={getX(thresholds.green_75)} width={getWidth(thresholds.green_75, thresholds.amber_high)} height="100%" fill={colors.greenMid} />
            <rect x={getX(thresholds.amber_high)} width={getWidth(thresholds.amber_high, thresholds.red_high)} height="100%" fill={colors.amber} />
            <rect x={getX(thresholds.red_high)} width={getWidth(thresholds.red_high, Infinity)} height="100%" fill={colors.red} />
          </>
        ) : thresholds.red_low !== undefined ? (
          <>
            <rect x="0%" width={getX(thresholds.red_low)} height="100%" fill={colors.red} />
            <rect x={getX(thresholds.red_low)} width={getWidth(thresholds.red_low, thresholds.amber_low)} height="100%" fill={colors.amber} />
            <rect x={getX(thresholds.amber_low)} width={getWidth(thresholds.amber_low, thresholds.amber_high)} height="100%" fill={colors.greenDark} />
            <rect x={getX(thresholds.amber_high)} width={getWidth(thresholds.amber_high, thresholds.red_high)} height="100%" fill={colors.amber} />
            <rect x={getX(thresholds.red_high)} width={getWidth(thresholds.red_high, Infinity)} height="100%" fill={colors.red} />
          </>
        ) : thresholds.amber !== undefined && thresholds.red !== undefined ? (
          <>
            <rect x="0%" width={getX(thresholds.amber)} height="100%" fill={colors.greenDark} />
            <rect x={getX(thresholds.amber)} width={getWidth(thresholds.amber, thresholds.red)} height="100%" fill={colors.amber} />
            <rect x={getX(thresholds.red)} width={getWidth(thresholds.red, Infinity)} height="100%" fill={colors.red} />
          </>
        ) : null}

        {/* 2. P5 & P95 Vertical Reference Lines */}
        {isThera && (
          <>
            <line x1={getX(thresholds.p5)} y1="0%" x2={getX(thresholds.p5)} y2="100%" stroke="#d97706" strokeOpacity="0.65" strokeWidth={isEnlarged ? '1.6' : '1'} strokeDasharray="3,2" />
            {showBothP5P95 && (
              <text x={getX(thresholds.p5)} y="14%" fontSize={fontSize} textAnchor="middle" fill="#b45309" fontFamily="monospace" fontWeight="bold">5%</text>
            )}
            <line x1={getX(thresholds.p95)} y1="0%" x2={getX(thresholds.p95)} y2="100%" stroke="#d97706" strokeOpacity="0.65" strokeWidth={isEnlarged ? '1.6' : '1'} strokeDasharray="3,2" />
            <text x={getX(thresholds.p95)} y="14%" fontSize={fontSize} textAnchor="middle" fill="#b45309" fontFamily="monospace" fontWeight="bold">95%</text>
          </>
        )}

        {/* 3. Unified Center Axis Whiskers & Translucent Box Fill (y = 50% center) */}
        <line x1={getX(whiskerMin)} y1="50%" x2={getX(q1)} y2="50%" stroke="#475569" strokeWidth={strokeW} />
        <line x1={getX(q3)} y1="50%" x2={getX(whiskerMax)} y2="50%" stroke="#475569" strokeWidth={strokeW} />

        <line x1={getX(whiskerMin)} y1="36%" x2={getX(whiskerMin)} y2="64%" stroke="#475569" strokeWidth={strokeW} />
        <line x1={getX(whiskerMax)} y1="36%" x2={getX(whiskerMax)} y2="64%" stroke="#475569" strokeWidth={strokeW} />

        <rect
          x={`${boxLeftPct.toFixed(2)}%`}
          y="25%"
          width={`${boxWidthPct.toFixed(2)}%`}
          height="50%"
          fill="rgba(255, 255, 255, 0.72)"
          stroke="none"
          rx={isEnlarged ? '3' : '1.5'}
        />

        {/* 4. Centered 1D Density-Aware Beeswarm Scatter Points (y = 50% ± 20%) */}
        {beeswarmPoints.map((pt, i) => (
          <circle
            key={i}
            cx={pt.cx}
            cy={pt.cy}
            r={r}
            fill={pt.fill}
            stroke={isEnlarged ? 'rgba(255,255,255,0.65)' : 'none'}
            strokeWidth={isEnlarged ? '0.6' : '0'}
          />
        ))}

        {/* 5. Crisp Box Border & Median Line Overlay on Top */}
        <rect
          x={`${boxLeftPct.toFixed(2)}%`}
          y="25%"
          width={`${boxWidthPct.toFixed(2)}%`}
          height="50%"
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeW}
          rx={isEnlarged ? '3' : '1.5'}
        />
        <line x1={getX(median)} y1="25%" x2={getX(median)} y2="75%" stroke="#2563eb" strokeWidth={isEnlarged ? '3.2' : '2.2'} />

        {/* 6. Quartile Labels at Bottom (Collision-Free) */}
        {showSeparateQuartiles ? (
          <>
            <text x={getX(q1)} y="92%" fontSize={fontSize} textAnchor="middle" fill="#334155" fontFamily="monospace" fontWeight="bold">25%</text>
            <text x={getX(q3)} y="92%" fontSize={fontSize} textAnchor="middle" fill="#334155" fontFamily="monospace" fontWeight="bold">75%</text>
          </>
        ) : (
          <text x={getX(median)} y="92%" fontSize={fontSize} textAnchor="middle" fill="#334155" fontFamily="monospace" fontWeight="bold">25–75%</text>
        )}
      </svg>
    </div>
  );
};

const MetricDisplay: React.FC<{ metric: string; th: any; metaKey?: string; chainBadge?: string }> = ({
  metric,
  th,
  metaKey,
  chainBadge
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, { pixelRatio: 3, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `${metaKey || metric}_boxplot.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download image', err);
    }
  };

  const baseDisplayName = displayNames[metric] || metric.replace(/_/g, ' ');
  const displayName = chainBadge ? `${chainBadge} · ${baseDisplayName}` : baseDisplayName;
  const meta = resolveMetricMeta(metaKey || metric);
  const rows: any[] = [];

  const countIn = (min: number, max: number, incMin = true, incMax = false) => {
    if (!th?.raw_data) return 0;
    return th.raw_data.filter((v: number) => {
      const gte = incMin ? v >= min : v > min;
      const lte = incMax ? v <= max : v < max;
      return gte && lte;
    }).length;
  };

  if (th?.p0 !== undefined) {
    rows.push({ label: '< 0% (Red)', value: `< ${th.p0}`, tone: 'text-rose-600', count: countIn(-Infinity, th.p0, false, false) });
    rows.push({ label: '0–5% (Amber)', value: `${th.p0} – ${th.p5}`, tone: 'text-amber-600', count: countIn(th.p0, th.p5, true, false) });
    rows.push({ label: '5–10% (L-Green)', value: `${th.p5} – ${th.p10}`, tone: 'text-emerald-600', count: countIn(th.p5, th.p10, true, false) });
    rows.push({ label: '10–25% (M-Green)', value: `${th.p10} – ${th.p25}`, tone: 'text-emerald-700', count: countIn(th.p10, th.p25, true, false) });
    rows.push({ label: '25–75% (Optimal)', value: `${th.p25} – ${th.p75}`, tone: 'text-emerald-800 font-bold', count: countIn(th.p25, th.p75, true, true), highlight: true });
    rows.push({ label: '75–90% (M-Green)', value: `${th.p75} – ${th.p90}`, tone: 'text-emerald-700', count: countIn(th.p75, th.p90, false, true) });
    rows.push({ label: '90–95% (L-Green)', value: `${th.p90} – ${th.p95}`, tone: 'text-emerald-600', count: countIn(th.p90, th.p95, false, true) });
    rows.push({ label: '95–100% (Amber)', value: `${th.p95} – ${th.p100}`, tone: 'text-amber-600', count: countIn(th.p95, th.p100, false, true) });
    rows.push({ label: '> 100% (Red)', value: `> ${th.p100}`, tone: 'text-rose-600', count: countIn(th.p100, Infinity, false, false) });
  } else if (th?.red_low !== undefined && th?.green_25 !== undefined) {
    rows.push({ label: '< 5% (Red)', value: `< ${th.red_low}`, tone: 'text-rose-600' });
    rows.push({ label: '5–10% (Amber)', value: `${th.red_low} – ${th.amber_low}`, tone: 'text-amber-600' });
    rows.push({ label: '10–25% (Green)', value: `${th.amber_low} – ${th.green_25}`, tone: 'text-emerald-700' });
    rows.push({ label: '25–75% (Optimal)', value: `${th.green_25} – ${th.green_75}`, tone: 'text-emerald-800 font-bold', highlight: true });
    rows.push({ label: '75–90% (Green)', value: `${th.green_75} – ${th.amber_high}`, tone: 'text-emerald-700' });
    rows.push({ label: '90–95% (Amber)', value: `${th.amber_high} – ${th.red_high}`, tone: 'text-amber-600' });
    rows.push({ label: '> 95% (Red)', value: `> ${th.red_high}`, tone: 'text-rose-600' });
  } else if (th?.red_low !== undefined) {
    rows.push({ label: 'Red (Low)', value: `< ${th.red_low}`, tone: 'text-rose-600' });
    rows.push({ label: 'Amber (Low)', value: `${th.red_low} – ${th.amber_low}`, tone: 'text-amber-600' });
    rows.push({ label: 'Green', value: `${th.amber_low} – ${th.amber_high}`, tone: 'text-emerald-800 font-bold', highlight: true });
    rows.push({ label: 'Amber (High)', value: `${th.amber_high} – ${th.red_high}`, tone: 'text-amber-600' });
    rows.push({ label: 'Red (High)', value: `> ${th.red_high}`, tone: 'text-rose-600' });
  } else if (th?.amber !== undefined && th?.red !== undefined) {
    rows.push({ label: 'Green', value: `≤ ${th.amber}`, tone: 'text-emerald-800 font-bold', highlight: true });
    rows.push({ label: 'Amber', value: `${th.amber} – ${th.red}`, tone: 'text-amber-600' });
    rows.push({ label: 'Red', value: `> ${th.red}`, tone: 'text-rose-600' });
  }

  return (
    <>
      <div className="bg-white border border-surface-200 rounded-xl flex flex-col h-full transition-colors hover:border-surface-300">
        {/* Card Header */}
        <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-surface-900 text-sm truncate" title={displayName}>
              {displayName}
            </span>
            {meta && (
              <InfoTooltip
                title={meta.label}
                unit={meta.unit}
                summary={meta.summary}
                method={meta.method}
                formula={meta.formula}
                example={meta.example}
                note={meta.benchmarkNote}
                align="left"
              />
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs font-mono tabular-nums text-surface-500">
            {th?.p50 !== undefined && (
              <span>
                Med <strong className="text-surface-900">{th.p50}</strong>
              </span>
            )}
            {meta?.unit && (
              <span className="text-[11px] text-surface-400">({meta.unit})</span>
            )}
          </div>
        </div>

        {/* Box & Scatter Plot */}
        {th?.raw_data && th.raw_data.length > 0 && (
          <div className="px-4 pt-3 pb-2 border-b border-surface-100 bg-surface-50/50 relative group">
            <BoxScatterPlot data={th.raw_data} thresholds={th} />
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="absolute inset-0 bg-surface-900/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              <span className="bg-white px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold text-surface-800 flex items-center gap-1.5 border border-surface-200">
                <Maximize2 className="w-3.5 h-3.5 text-brand-600" /> Enlarge &amp; Export
              </span>
            </button>
          </div>
        )}

        {/* Quantile Table */}
        <table className="w-full text-left border-collapse text-xs flex-1">
          <tbody className="divide-y divide-surface-100">
            {rows.map((row, i) => (
              <tr
                key={i}
                className={row.highlight ? 'bg-emerald-50/40' : 'hover:bg-surface-50/70'}
              >
                <td className={`px-4 py-1.5 whitespace-nowrap w-[44%] font-medium ${row.tone}`}>
                  {row.label}
                </td>
                <td className="px-4 py-1.5 font-mono tabular-nums text-surface-800 text-right">
                  <span className="font-semibold">{row.value}</span>
                  {row.count !== undefined && (
                    <span className="text-[11px] text-surface-400 ml-2">
                      (n={row.count})
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-900/60 backdrop-blur-xs p-4 sm:p-8" onClick={() => setIsModalOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-full overflow-hidden flex flex-col border border-surface-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-surface-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-surface-900 text-base">{displayName}</h3>
                <span className="text-xs font-mono text-surface-500">({metric})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 bg-surface-900 text-white hover:bg-surface-800 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export 300 DPI PNG
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-surface-400 hover:text-surface-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-auto flex-1 bg-surface-50">
              <div ref={chartRef} className="w-full bg-white p-6 rounded-xl border border-surface-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-surface-900 text-lg">{displayName} Distribution</h4>
                  {th?.count !== undefined && (
                    <span className="text-xs font-mono text-surface-500">Cohort N = {th.count} · Median = {th.p50}</span>
                  )}
                </div>
                <BoxScatterPlot data={th.raw_data} thresholds={th} isEnlarged={true} />
                <div className="mt-6 grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                  {rows.map((row, i) => (
                    <div key={i} className="bg-surface-50 p-2.5 rounded-lg border border-surface-200">
                      <div className={`font-semibold ${row.tone}`}>{row.label}</div>
                      <div className="font-mono font-bold text-surface-900 mt-0.5 tabular-nums">{row.value}</div>
                      {row.count !== undefined && <div className="text-[11px] text-surface-400 font-mono">n = {row.count}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface FilterDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  countsMap?: Record<string, { count: number; percent: number }>;
  onChange: (next: string[]) => void;
}

const FilterDropdown = ({ label, options, selected, countsMap, onChange }: FilterDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredOptions = (options || []).filter((opt: string) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-between gap-2 min-w-[148px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
          selected.length > 0
            ? 'bg-brand-50/90 border-brand-400 text-brand-900 shadow-2xs ring-2 ring-brand-500/10'
            : open
            ? 'bg-surface-50 border-brand-400 text-surface-900 shadow-2xs'
            : 'bg-white border-surface-200/90 text-surface-700 hover:border-surface-300 hover:bg-surface-50/70 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className={selected.length > 0 ? 'text-brand-700 font-medium' : 'text-surface-500'}>{label}:</span>
          <span
            className={`truncate px-1.5 py-0.5 rounded text-[11px] font-semibold ${
              selected.length > 0
                ? 'bg-brand-600 text-white'
                : 'bg-surface-100 text-surface-700'
            }`}
          >
            {selected.length === 0 ? 'All' : selected.length === 1 ? selected[0] : `${selected.length} selected`}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180 text-brand-600' : selected.length > 0 ? 'text-brand-600' : 'text-surface-400'
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 z-[110] mt-1.5 w-64 bg-white border border-surface-200 rounded-xl shadow-xl p-2 flex flex-col gap-1 max-h-[340px]">
          <div className="px-2 py-1.5 flex items-center justify-between border-b border-surface-100">
            <span className="text-xs font-semibold text-surface-700">{label}</span>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onChange([...options])}
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                Select All
              </button>
              <span className="text-surface-300">·</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-surface-500 hover:text-surface-800 font-medium"
              >
                Clear
              </button>
            </div>
          </div>

          {options.length > 5 && (
            <div className="px-1.5 py-1 relative">
              <Search className="w-3.5 h-3.5 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Filter ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-7 pr-2.5 py-1.5 bg-surface-50 border border-surface-200 rounded-lg focus:outline-none focus:bg-white focus:border-brand-500"
              />
            </div>
          )}

          <div className="overflow-y-auto custom-scrollbar flex-1 divide-y divide-surface-50">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-4 text-xs text-surface-400 text-center">
                No options available
              </div>
            ) : (
              filteredOptions.map((opt: string) => {
                const isChecked = selected.includes(opt);
                const stat = countsMap?.[opt];
                return (
                  <label
                    key={opt}
                    className={`flex items-center justify-between gap-2 cursor-pointer px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      isChecked ? 'bg-brand-50/70 text-brand-900 font-semibold' : 'hover:bg-surface-50 text-surface-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        className="rounded text-brand-600 focus:ring-brand-500 border-surface-300 w-3.5 h-3.5 shrink-0"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) onChange([...selected, opt]);
                          else onChange(selected.filter((s: string) => s !== opt));
                        }}
                      />
                      <span className="truncate">{opt}</span>
                    </div>
                    {stat && (
                      <span className="text-[11px] font-mono tabular-nums text-surface-400 shrink-0">
                        {stat.count} ({stat.percent}%)
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface GuidelinesProps {
  sshConnected: boolean;
  refreshKey: number;
}

export default function Guidelines({ refreshKey }: GuidelinesProps) {
  const [data, setData] = useState<any>(null);
  const [error] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Clean Separation of TAP (mAb) and TNP (VHH)
  const [activeModality, setActiveModality] = useState<'TAP' | 'TNP'>(() => {
    const saved = localStorage.getItem('guidelinesModality');
    return saved === 'TNP' ? 'TNP' : 'TAP';
  });
  const [activeSection, setActiveSection] = useState<'all' | 'structural' | 'sequence' | 'liability'>('all');
  const [activeTapChain, setActiveTapChain] = useState<'VHVL' | 'VH' | 'VL'>('VHVL');

  const [filters, setFilters] = useState<CohortFilters>(() => loadCohortFilters());

  useEffect(() => {
    localStorage.setItem('guidelinesModality', activeModality);
  }, [activeModality]);

  useEffect(() => {
    saveCohortFilters(filters);
  }, [filters]);

  const fetchGuidelines = async () => {
    try {
      const params = buildGuidelinesSearchParams(filters);
      const res = await axios.get(`/api/guidelines?${params.toString()}`);
      setData(res.data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGuidelines();
  }, [filters, refreshKey]);

  const updateFilter = (key: keyof CohortFilters, next: string[]) => {
    setFilters(prev => ({ ...prev, [key]: next }));
  };

  const clearCurrentModalityFilters = () => {
    if (activeModality === 'TAP') {
      setFilters(prev => ({
        ...prev,
        tapStages: [],
        tapGenetics: [],
        tapYears: [],
        tapTargets: []
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        tnpStages: [],
        tnpGenetics: [],
        tnpYears: [],
        tnpTargets: []
      }));
    }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        <RefreshCw className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const isTap = activeModality === 'TAP';
  const tapCount = data.therasabdab?.count_VHVL || 0;
  const tnpCount = data.therasabdab?.count_VHH || 0;
  const activeCount = isTap ? tapCount : tnpCount;
  const activeFilterCount = countModalityFilters(filters, activeModality);

  // Build genetics count map for inside the Genetics dropdown
  const geneticsCountsMap: Record<string, { count: number; percent: number }> = {};
  const breakdownList = isTap ? (data.tapGeneticsBreakdown || []) : (data.tnpGeneticsBreakdown || []);
  for (const item of breakdownList) {
    geneticsCountsMap[item.label] = { count: item.count, percent: item.percent };
  }

  const currentStages = isTap ? filters.tapStages : filters.tnpStages;
  const currentGenetics = isTap ? filters.tapGenetics : filters.tnpGenetics;
  const currentYears = isTap ? filters.tapYears : filters.tnpYears;
  const currentTargets = isTap ? filters.tapTargets : filters.tnpTargets;

  const availableStages = isTap ? (data.metadata?.availableTapStages || []) : (data.metadata?.availableTnpStages || []);
  const availableGenetics = isTap ? (data.metadata?.availableTapGenetics || []) : (data.metadata?.availableTnpGenetics || []);
  const availableYears = isTap ? (data.metadata?.availableTapYears || []) : (data.metadata?.availableTnpYears || []);
  const availableTargets = isTap ? (data.metadata?.availableTapTargets || []) : (data.metadata?.availableTnpTargets || []);

  const structuralMetrics = isTap ? (data.tap || {}) : (data.tnp || {});
  const sequenceGroup = isTap ? (data.therasabdab?.VHVL || {}) : (data.therasabdab?.VHH || {});

  return (
    <div className="space-y-8 pb-12">
      {/* Unified Control & Filter Bar (100% Opaque Sticky Header Shield) */}
      <div className="sticky top-[56px] z-30 bg-surface-50 -mt-3 pt-3 pb-3 -mx-3 px-3">
        <div className="bg-white border border-surface-200/90 rounded-2xl p-4 space-y-3.5 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.08)]">
          {/* Row 1: Primary Modality Switch (TAP vs TNP) with Section Tabs directly underneath */}
          <div className="flex flex-col gap-3 pb-3.5 border-b border-surface-100">
            {/* Modality Segmented Control */}
            <div className="flex flex-wrap items-center gap-1.5 bg-surface-100/90 p-1.5 rounded-xl border border-surface-200/80 self-start">
              <button
                type="button"
                onClick={() => setActiveModality('TAP')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2.5 cursor-pointer ${
                  isTap
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                    : 'text-surface-600 hover:text-surface-900 hover:bg-white/70'
                }`}
              >
                <span className="tracking-tight">TAP 2024 · Conventional mAbs (VH+VL)</span>
                <span
                  className={`font-mono tabular-nums text-[11px] px-2 py-0.5 rounded-md font-bold ${
                    isTap
                      ? 'bg-white/20 text-white border border-white/25'
                      : 'bg-surface-200/70 text-surface-600'
                  }`}
                >
                  N={tapCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModality('TNP')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2.5 cursor-pointer ${
                  !isTap
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                    : 'text-surface-600 hover:text-surface-900 hover:bg-white/70'
                }`}
              >
                <span className="tracking-tight">TNP 2025 · Nanobodies (VHH)</span>
                <span
                  className={`font-mono tabular-nums text-[11px] px-2 py-0.5 rounded-md font-bold ${
                    !isTap
                      ? 'bg-white/20 text-white border border-white/25'
                      : 'bg-surface-200/70 text-surface-600'
                  }`}
                >
                  N={tnpCount}
                </span>
              </button>
            </div>

            {/* Section View Tabs (Positioned directly below TAP/TNP switcher) */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 bg-surface-100/80 p-1 rounded-xl border border-surface-200/80">
                {[
                  { id: 'all', code: 'ALL', label: 'All Sections' },
                  { id: 'structural', code: '01', label: '3D Surface & CDR' },
                  { id: 'sequence', code: '02', label: 'Physicochemical' },
                  { id: 'liability', code: '03', label: 'PTM & IMGT Hotspots' }
                ].map(sec => {
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setActiveSection(sec.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? isTap
                            ? 'bg-white text-brand-700 font-semibold shadow-xs border border-brand-200 ring-1 ring-brand-500/10'
                            : 'bg-white text-indigo-700 font-semibold shadow-xs border border-indigo-200 ring-1 ring-indigo-500/10'
                          : 'text-surface-600 hover:text-surface-900 hover:bg-white/60 border border-transparent'
                      }`}
                    >
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          isActive
                            ? isTap
                              ? 'bg-brand-50 text-brand-700'
                              : 'bg-indigo-50 text-indigo-700'
                            : 'bg-surface-200/70 text-surface-500'
                        }`}
                      >
                        {sec.code}
                      </span>
                      <span>{sec.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Unified 4-Dimension Cohort Filter Bar for the Active Modality */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-surface-700 bg-surface-100/80 border border-surface-200/80 px-2.5 py-1.5 rounded-lg mr-0.5 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isTap ? 'bg-brand-600' : 'bg-indigo-600'}`} />
                <span>Cohort Filters ({isTap ? 'TAP mAb' : 'TNP VHH'})</span>
                <InfoTooltip
                  title="Unified 4D Cohort Filtering (四维临床参考库动态筛选)"
                  summary="支持按临床研发阶段（Clinical Stage，如 Approved、Phase 3/2/1）、基因源性（Genetics，如 Human、Humanised、Chimeric、Bispecific）、获批/推荐年份（Year）及作用靶点（Target）对参考库进行多维交集筛选。"
                  method="每次勾选或取消筛选条件时，后端实时过滤参考库样本集，并基于过滤后的活跃子集（Active Cohort N）动态重算所有 3D 与 1D 指标的 9 个经验分位数（P0, P5, P10, P25, P50, P75, P90, P95, P100）以及 4-Tier PTM IMGT 热点频率。同一筛选状态会自动同步至 Results 结果表，用于动态重判红/黄/绿成药性色阶。"
                  formula="Cohort_active = { mAb ∈ DB | Stage ∈ S ∧ Genetics ∈ G ∧ Year ∈ Y ∧ Target ∈ T }"
                  example="例如：在 TAP 2024 中勾选 Clinical Stage = [Approved] 且 Genetics = [Human]，活跃队列收缩为已获批全人源单抗子集，所有箱线图阈值与结果表色阶立即切换为全人源获批抗体的严苛标准。"
                  align="left"
                />
              </span>

              <FilterDropdown
                label="Clinical Stage"
                options={availableStages}
                selected={currentStages}
                onChange={(val) => updateFilter(isTap ? 'tapStages' : 'tnpStages', val)}
              />

              <FilterDropdown
                label="Genetics"
                options={availableGenetics}
                selected={currentGenetics}
                countsMap={geneticsCountsMap}
                onChange={(val) => updateFilter(isTap ? 'tapGenetics' : 'tnpGenetics', val)}
              />

              <FilterDropdown
                label="Year"
                options={availableYears}
                selected={currentYears}
                onChange={(val) => updateFilter(isTap ? 'tapYears' : 'tnpYears', val)}
              />

              <FilterDropdown
                label="Target"
                options={availableTargets}
                selected={currentTargets}
                onChange={(val) => updateFilter(isTap ? 'tapTargets' : 'tnpTargets', val)}
              />

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearCurrentModalityFilters}
                  className="text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/90 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Clear Filters ({activeFilterCount})
                </button>
              )}
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-mono tabular-nums bg-emerald-50/90 border border-emerald-200/90 text-emerald-900 px-3 py-1.5 rounded-lg shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-emerald-700 font-sans font-medium">Active Cohort:</span>
              <strong className="text-emerald-950 font-bold">N = {activeCount}</strong>
            </div>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-xl text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 01: 3D Surface & CDR Guidelines (Separated by Modality) */}
      {(activeSection === 'all' || activeSection === 'structural') && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-200 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-surface-900">
                01. {isTap ? 'TAP 2024 3D Structural Surface & CDR Guidelines' : 'TNP 2025 3D Structural Surface & CDR Guidelines'}
              </h3>
              <InfoTooltip
                title={isTap ? 'TAP 2024 3D Surface Profiling (传统单抗 3D 结构成药性)' : 'TNP 2025 3D Nanobody Profiling (纳米抗体 3D 结构成药性)'}
                summary={
                  isTap
                    ? '基于牛津大学 OPIG TAP 2024 标准，对 ABodyBuilder2 预测或晶体解析的 Fv（VH+VL）三维结构进行表面理化斑块剖析，涵盖总 CDR 长度（L_tot）、表面疏水斑块（PSH）、正/负电荷斑块（PPC/PNC）与重轻链电荷对称性（SFvCSP）。'
                    : '基于牛津大学 OPIG TNP 2025 标准，对 NanoBodyBuilder2 预测或实验解析的单域 VHH 三维结构进行成药性评估，涵盖总 CDR 长度（L）、CDR3 长度（L3）、CDR3 回折紧凑度（C）以及表面疏水/正负电荷斑块（PSH/PPC/PNC）。'
                }
                method="流程：(1) 调用 ANARCI 进行 IMGT 标准编号并划分 CDR 与 FR 边界；(2) 调用 Joy PSA 计算每个残基侧链的相对溶剂可及表面积（RSA ≥ 7.5% 判定为表面暴露）；(3) 识别 4.0 Å CDR 邻域及 3.2 Å 分子内盐桥；(4) 对 < 7.5 Å 的暴露残基对按距离平方反比积分。"
                formula="5-Tier 色阶：D-GREEN (25–75% IQR) · M-GREEN (10–25% / 75–90%) · L-GREEN (5–10% / 90–95%) · AMBER (0–5% / 95–100%) · RED (<0% / >100%)"
                example={
                  isTap
                    ? '例如某候选单抗 PSH = 122.4（落入 25%–75% IQR 核心区，标为 D-GREEN），但 SFvCSP = −12.5 e²（落入 0%–5% 极端尾部，标为 AMBER），提示该分子表面疏水性良好，但重轻链异号电荷偶极吸引较强。'
                    : '例如某候选 VHH 的 L3 = 17 AA、紧凑度 C = 1.85 AA/Å（回折遮蔽 FR2）、PSH = 118.0，全部落入 25%–75% 最优核心区（D-GREEN）。'
                }
                align="left"
              />
            </div>
            <div className="text-xs text-surface-500">
              <span>5-Tier Quantiles</span>
              <span className="mx-1.5">·</span>
              <span className="font-mono tabular-nums">N = {activeCount}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.entries(structuralMetrics).map(([metric, th]: [string, any]) => (
              <MetricDisplay
                key={`${activeModality}-${metric}`}
                metric={metric}
                metaKey={`${isTap ? 'TAP' : 'TNP'}_${metric}`}
                th={th}
              />
            ))}
          </div>
        </section>
      )}

      {/* SECTION 02: Physicochemical Guidelines (Separated by Modality & Chain) */}
      {(activeSection === 'all' || activeSection === 'sequence') && (
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-200 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-surface-900">
                02.{' '}
                {isTap
                  ? activeTapChain === 'VHVL'
                    ? 'mAb Whole Fv (VH+VL) Physicochemical Guidelines'
                    : activeTapChain === 'VH'
                    ? 'mAb Heavy Chain (VH) Physicochemical Guidelines'
                    : 'mAb Light Chain (VL) Physicochemical Guidelines'
                  : 'VHH Single-Domain Physicochemical Guidelines'}
              </h3>
              <InfoTooltip
                title={
                  isTap
                    ? activeTapChain === 'VHVL'
                      ? 'VH+VL (Whole Fv) Biophysical Model (双链 Fv 整体生物物理模型)'
                      : activeTapChain === 'VH'
                      ? 'VH Heavy Chain Biophysical Model (独立重链可变区生物物理模型)'
                      : 'VL Light Chain Biophysical Model (独立轻链可变区 κ/λ 生物物理模型)'
                    : 'VHH Single-Domain Biophysical Model (单域纳米抗体生物物理模型)'
                }
                summary={
                  isTap
                    ? activeTapChain === 'VHVL'
                      ? '评估完整抗原结合可变区复合物（VH+VL Heterodimer）的宏观溶液理化性质。直接决定全长 IgG、Fab 或 scFv 的整体溶液净电荷、阳离子交换层析（CEX）洗脱行为、高浓度胶体排斥力与热力学稳定性。'
                      : activeTapChain === 'VH'
                      ? '单独评估重链可变区（VH，IMGT 1–128）的一维理化性质。VH 通常携带较长的多样化 CDRH3，是驱动抗体疏水聚集倾向（GRAVY 偏高）与内质网折叠限速的主要结构域；对比 VH 与 VL 的电荷可揭示重轻链偶极非对称性。'
                      : '单独评估轻链可变区（VL，含 Vκ 与 Vλ，IMGT 1–127）的一维理化性质。VL 序列高度保守且普遍较 VH 更亲水、等电点更偏中性/弱酸性，在内质网中通过 BiP 伴侣结合辅助重链折叠并稳定 VH/VL 界面。'
                    : '评估单域纳米抗体（VHH）的一维序列理化参数，包括长度、分子量（MW）、等电点（pI）、GRAVY 亲疏水性、Guruprasad 不稳定指数、pH 7.4 净电荷与可变区 N-糖基化位点数。'
                }
                method={
                  isTap
                    ? activeTapChain === 'VHVL'
                      ? '采用严格的双链复合物算法（绝不将 VH 与 VL 简单文本拼接）：\n1. 长度与分子量：L_Fv = L_VH + L_VL，MW_Fv = MW_VH + MW_VL（保留 2 个游离 N 端与 2 个游离 C 端，共扣除 (L_Fv − 2) 个肽键水分子，比错误单链拼接精确多出 +18.015 Da）；\n2. 等电点 pI_Fv：通过双链联合 Henderson-Hasselbalch 方程 Z_VH(pH) + Z_VL(pH) = 0 在 [0, 14] 区间二分法求根；\n3. GRAVY 与不稳定指数：按重轻链残基长度或二肽总数加权平均，彻底杜绝 VH C 端与 VL N 端跨链拼接产生虚构伪二肽。'
                      : activeTapChain === 'VH'
                      ? '仅针对重链可变区序列 S_VH（含 1 个游离 N 端 α-NH3+ 与 1 个游离 C 端 α-COO-）独立计算：(1) 扣除 (L_VH − 1) 个肽键水分子计算 MW_VH；(2) 对 Z_VH(pH) = 0 求根得到重链独立 pI_VH；(3) 在 (L_VH − 1) 个重链内部相邻二肽上滑动计算 Guruprasad 不稳定指数 II_VH。'
                      : '仅针对轻链可变区序列 S_VL（含 1 个游离 N 端 α-NH3+ 与 1 个游离 C 端 α-COO-）独立计算：(1) 扣除 (L_VL − 1) 个肽键水分子计算 MW_VL；(2) 对 Z_VL(pH) = 0 求根得到轻链独立 pI_VL；(3) 在 (L_VL − 1) 个轻链内部相邻二肽上滑动计算 Guruprasad 不稳定指数 II_VL。'
                    : '基于标准氨基酸质量表、Henderson-Hasselbalch pKa 解离常数表、Kyte-Doolittle 亲疏水标度及 Guruprasad 400 二肽不稳定矩阵对单条 VHH 肽链逐项精确计算。'
                }
                formula={
                  isTap
                    ? activeTapChain === 'VHVL'
                      ? 'MW_Fv = MW_VH + MW_VL · pI_Fv: Z_VH(pH)+Z_VL(pH)=0 · II_Fv = [(L_H−1)II_H + (L_L−1)II_L]/(L_H+L_L−2)'
                      : activeTapChain === 'VH'
                      ? 'MW_VH = ∑ m(aa_i) − (L_VH−1)×18.015 · pI_VH: Z_VH(pH)=0 · II_VH = (10/L_VH) ∑ DIWV(d_i)'
                      : 'MW_VL = ∑ m(aa_i) − (L_VL−1)×18.015 · pI_VL: Z_VL(pH)=0 · II_VL = (10/L_VL) ∑ DIWV(d_i)'
                    : 'MW_VHH = ∑ m(aa_i) − (L−1)×18.015 · Z_VHH(pH) = ∑ q_pos(pH) − ∑ q_neg(pH)'
                }
                example={
                  isTap
                    ? activeTapChain === 'VHVL'
                      ? '例如：当 VH (120 AA, MW 13,120 Da, pI 8.95, q7.4 +2.6e, II 34.8) 与 VL (107 AA, MW 11,640 Da, pI 5.95, q7.4 −0.8e, II 38.2) 配对时 → Whole Fv 长度为 227 AA，MW = 24,760 Da，联合求根 pI_Fv = 8.15，净电荷 = +1.8e，加权 II_Fv = 36.40。'
                      : activeTapChain === 'VH'
                      ? '例如：某单抗整体 Fv 的 Instability = 38.5（看似合格），但切换到 VH Chain 视图发现 II_VH = 47.2（> 40 不稳定，AMBER），而 II_VL = 28.8，立即定位出稳定性短板位于重链而非轻链。'
                      : '例如：切换到 VL Chain 视图，若发现 q_VL(7.4) = −3.2 e（负电显著）而 VH 视图中 q_VH(7.4) = +4.5 e（正电显著），说明两条链存在强烈异号电荷偶极吸引，解释了为何 3D 指标中 SFvCSP 呈现极端负值。'
                    : '例如：VHH 长度 122 AA，MW = 13,250 Da，pI = 7.85，GRAVY = −0.38，Instability = 33.4，NGlyc = 0（全部处于临床最优区 D-GREEN）。'
                }
                align="left"
              />
            </div>

            {isTap && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="flex items-center bg-surface-100 p-1 rounded-lg border border-surface-200">
                  {[
                    { id: 'VHVL', label: 'VH+VL (Whole Fv)' },
                    { id: 'VH', label: 'VH Chain' },
                    { id: 'VL', label: 'VL Chain' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTapChain(tab.id as any)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        activeTapChain === tab.id
                          ? 'bg-white text-surface-900 font-semibold shadow-2xs'
                          : 'text-surface-600 hover:text-surface-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <InfoTooltip
                  title="Chain View Selector (切换双链整体 Fv / 独立重链 VH / 独立轻链 VL)"
                  summary="切换查看传统单抗在不同结构域尺度下的参考库分位数基准与计算模型。三个选项卡不仅统计分布完全独立，底层的生物物理计算公式与工程指导意义也截然不同。"
                  method={`• VH+VL (Whole Fv)：评估双链复合物整体（加和 Length/MW/Charge/NGlyc，双链联合方程求根 pI，残基长度加权 GRAVY/Instability）；\n• VH Chain：仅评估重链可变区（IMGT 1–128），反映重链框架与高变 CDRH3 的独立溶解度、电荷与折叠稳定性；\n• VL Chain：仅评估轻链可变区（IMGT 1–127，Vκ/Vλ），反映轻链的独立理化特征及对 VH/VL 界面稳定性的贡献。`}
                  formula="切换此选项卡后，下方 7 张参数卡片的箱线图分位数与右侧 ? 帮助文档将同步切换为对应链的专属定义、公式与算例。"
                  example="例如：点击「VH+VL (Whole Fv)」查看双链联合 pI_Fv 与双末端分子量 MW_Fv；点击「VH Chain」或「VL Chain」分别查看单条重链或单条轻链的独立理化参数与专属解读。"
                  align="right"
                />
              </div>
            )}
          </div>

          {isTap ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sequenceGroup[activeTapChain] &&
                Object.entries(sequenceGroup[activeTapChain]).map(([prop, stats]: [string, any]) => (
                  <MetricDisplay
                    key={`${activeTapChain}-${prop}`}
                    metric={prop}
                    metaKey={`${activeTapChain}_${prop}`}
                    chainBadge={activeTapChain === 'VHVL' ? 'VH+VL' : activeTapChain}
                    th={stats}
                  />
                ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sequenceGroup.VHH &&
                Object.entries(sequenceGroup.VHH).map(([prop, stats]: [string, any]) => (
                  <MetricDisplay
                    key={`VHH-${prop}`}
                    metric={prop}
                    metaKey={`VHH_${prop}`}
                    chainBadge="VHH"
                    th={stats}
                  />
                ))}
            </div>
          )}
        </section>
      )}

      {/* SECTION 03: 4-Tier PTM Matrix & IMGT Hotspot Atlas (Separated by Modality) */}
      {(activeSection === 'all' || activeSection === 'liability') && (
        <LiabilityGuidelinesSection
          modality={activeModality}
          liabilityStats={data.liabilityStats}
        />
      )}

      {/* Compact Scientific References Footer */}
      <footer className="pt-6 border-t border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-surface-500">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold text-surface-700">References:</span>
          <a href="https://doi.org/10.1038/s42003-023-05744-8" target="_blank" rel="noreferrer" className="hover:text-brand-600 inline-flex items-center gap-1">
            TAP 2024 (Commun. Biol. 7:62) <ExternalLink className="w-3 h-3" />
          </a>
          <span>·</span>
          <a href="https://doi.org/10.1101/2025.08.11.669635" target="_blank" rel="noreferrer" className="hover:text-brand-600 inline-flex items-center gap-1">
            TNP 2025 (bioRxiv) <ExternalLink className="w-3 h-3" />
          </a>
          <span>·</span>
          <a href="https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/sabdab/therapeutics/" target="_blank" rel="noreferrer" className="hover:text-brand-600 inline-flex items-center gap-1">
            TheraSAbDab &amp; IMGT Numbering <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="font-mono text-[11px] text-surface-400">
          IMGT Loops (CDR: 27–38, 56–65, 105–117 · FR-Loop: 14–17, 44–47, 68–73, 81–85, 95–97) · PSA RSA ≥ 7.5%
        </div>
      </footer>
    </div>
  );
}

function LiabilityGuidelinesSection({
  modality,
  liabilityStats
}: {
  modality: 'TAP' | 'TNP';
  liabilityStats: any;
}) {
  const isTap = modality === 'TAP';
  const [tapChain, setTapChain] = useState<'VHVL' | 'VH' | 'VL'>('VHVL');
  const [includeFrLoops, setIncludeFrLoops] = useState(false);
  const [showTierMatrix, setShowTierMatrix] = useState(false);

  const selectedChain = isTap ? tapChain : 'VHH';
  const rawChainStats = liabilityStats?.[selectedChain];
  const chainStats = includeFrLoops ? (rawChainStats?.withFrLoops || rawChainStats) : rawChainStats;
  const total = chainStats?.total || 0;
  const ts = chainStats?.tierSummary || {};

  const loopScopeTagText = includeFrLoops ? '[CDR-Loop/FR-Loop,Exp]' : '[CDR-Loop,Exp]';
  const loopScopeDescText = includeFrLoops
    ? 'CDR-Loop + FR-Loop (含 FR3 DE-turn/HV4 82–85 等框架转向环)'
    : 'CDR-Loop Only (与 01 模块严格对齐，仅计 3D CDR 环区)';

  const chainLabelText =
    selectedChain === 'VHVL'
      ? 'VH+VL (Whole Fv)'
      : selectedChain === 'VH'
      ? 'VH Heavy Chain'
      : selectedChain === 'VL'
      ? 'VL Light Chain'
      : 'VHH Nanobody';

  return (
    <section className="space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-200 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-surface-900">
            03.{' '}
            {isTap
              ? tapChain === 'VHVL'
                ? 'mAb Whole Fv (VH+VL) 4-Tier PTM Risk & IMGT Hotspot Atlas'
                : tapChain === 'VH'
                ? 'mAb Heavy Chain (VH) 4-Tier PTM Risk & IMGT Hotspot Atlas'
                : 'mAb Light Chain (VL) 4-Tier PTM Risk & IMGT Hotspot Atlas'
              : 'VHH 4-Tier PTM Risk & IMGT Hotspot Atlas'}
          </h3>
          <InfoTooltip
            title={`4-Tier PTM & IMGT Hotspot Gold Standard · ${chainLabelText}`}
            summary={
              selectedChain === 'VHVL'
                ? '评估完整双链 Fv（VH+VL）的联合翻译后修饰（PTM）风险图谱。将重链（VH:）与轻链（VL:）的所有 3D 结构检出位点合并汇总，按木桶短板原则（Worst-Case across VH & VL）判定整株抗体的 PTM 风险等级：仅当 VH 和 VL 同时不含任何 Tier 1/2/3 位点时，整株 Fv 才计为 Clean Molecule。'
                : selectedChain === 'VH'
                ? '单独评估单抗重链可变区（VH）的 4-Tier PTM 风险与 IMGT 热点分布。默认与 01 模块严格对齐（仅评估 3D CDR-Loop 暴露环区），开启 +FR-Loop 开关后可进一步纳入重链 FR3 DE-turn（HV4, IMGT 82–85）等框架转向环。'
                : selectedChain === 'VL'
                ? '单独评估单抗轻链可变区（VL）的 4-Tier PTM 风险与 IMGT 热点分布。VL 的化学风险高度集中于 CDRL1（IMGT 27–36）以及 CDRL3（IMGT 107–115）的暴露环区位点。'
                : '评估单域纳米抗体（VHH）的 4-Tier PTM 风险与 IMGT 热点分布。VHH 具有较长 CDR3 环且完全依靠单结构域结合抗原，任何暴露环区修饰或未配对游离 Cys 均直接影响活性。'
            }
            method={`100% 基于 3D PDB 结构（ANARCI IMGT 区域划分 + 3D Kabsch-Sander DSSP 主链氢键二级结构 Loop/Strand 识别 + PSA 反应残基自身 side_rsa ≥ 7.5% 暴露判定），格式化为 ${selectedChain === 'VHVL' ? 'Chain:linearPos@IMGTpos(Motif)[Region-SecStruct,Exp/Buried]' : 'linearPos@IMGTpos(Motif)[Region-SecStruct,Exp/Buried]'}：\n• Tier 1 Intolerable (RED)：游离 Cys（3D Sγ–Sγ > 3.0 Å）或潜在 N-糖基化 Nx[ST] except for NP[ST]；\n• Tier 2 High Risk (RED)：NG & DG; exposed & in loops（${loopScopeTagText}）；\n• Tier 3 Moderate Risk (AMBER)：M, W, NS, NT, NN, NH, DS, DD; exposed & in loops（${loopScopeTagText}）；\n• Tier 4 Low Risk (L-GREEN)：未列入前述等级的其他 15 种 Nx（含 NP）与 17 种 Dx（含 DP, DT, DH）; exposed & in loops（${loopScopeTagText}）；\n• Protected 结构保护态 (D-GREEN)：位于 β-折叠股（[CDR-Strand] / [FR-Strand]）或内部包埋（[*,Buried]）的受保护残基。`}
            formula={
              selectedChain === 'VHVL'
                ? `Sites(VHVL) = VH:Sites ∪ VL:Sites · Loop Scope: ${loopScopeTagText}`
                : `Active Scope: ${selectedChain} · Loop Scope: ${loopScopeTagText} · PSA RSA ≥ 7.5%`
            }
            example={
              selectedChain === 'VHVL'
                ? '例如：某单抗 VH 链含有 `VH:54@IMGT59(NG)[CDR-Loop,Exp]`（Tier 2 RED），而 VL 链完全洁净（D-GREEN）→ 在 VH+VL (Whole Fv) 视图下，该抗体计入 Tier 2 High Risk；切换到 VL Chain 视图下则计入 Clean Molecule。'
                : selectedChain === 'VH'
                ? '例如（VH 专属实例）：重链 CDRH2 `54@IMGT59(NG)[CDR-Loop,Exp]` 标为 Tier 2 RED；重链 CDR1 尾端 β-股茎部 `33@IMGT38(W)[CDR-Strand,Buried]` 与核心 `36@IMGT41(W)[FR-Strand,Buried]` 均标为 Protected（D-GREEN）。'
                : selectedChain === 'VL'
                ? '例如（VL 专属实例）：轻链 CDRL1 `28@IMGT29(NG)[CDR-Loop,Exp]` 标为 Tier 2 RED；轻链 CDRL3 `91@IMGT107(W)[CDR-Loop,Exp]` 标为 Tier 3 AMBER；轻链保守核心 `35@IMGT41(W)[FR-Strand,Buried]` 标为 Protected（D-GREEN）。'
                : '例如（VHH 专属实例）：纳米抗体 CDR3 `102@IMGT109(DG)[CDR-Loop,Exp]` 标为 Tier 2 RED；成对跨环二硫键（Free: No）标为 D-GREEN。'
            }
            align="left"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Loop Scope Switch: CDR-Loop Only (Default) vs + FR-Loop */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-surface-100 p-1 rounded-lg border border-surface-200">
              <button
                type="button"
                onClick={() => setIncludeFrLoops(false)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  !includeFrLoops
                    ? 'bg-brand-600 text-white font-semibold shadow-2xs'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                CDR-Loop Only (Default)
              </button>
              <button
                type="button"
                onClick={() => setIncludeFrLoops(true)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  includeFrLoops
                    ? 'bg-brand-600 text-white font-semibold shadow-2xs'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                + FR-Loop (Extended)
              </button>
            </div>
            <InfoTooltip
              title="Loop Scope Toggle · CDR-Loop Only (默认) vs. + FR-Loop (全面分析)"
              summary="控制四级风险体系中「exposed & in loops（处于暴露环区）」的环区识别范围。默认与 01. 3D Surface & CDR 保持 100% 严丝合缝（仅统计 CDR-Loop）；打开 + FR-Loop 开关后可全面纳入框架区暴露转向环。"
              method={`1. CDR-Loop Only（默认，与 01 模块 100% 一致）：\n   • 仅当位点位于 IMGT CDR 区间（27–38, 56–65, 105–117）、且在 3D PDB 结构中经 DSSP 主链氢键判定为真实柔性环（[CDR-Loop,Exp]，扣除两端形成 β-折叠氢键的刚性底座 [CDR-Strand]）、且 PSA side_rsa ≥ 7.5% 时，才触发 Tier 2/3/4 风险；\n   • 所有框架区位点（含人类 IGHV3 胚系保守的 FR3 DE-turn IMGT 82–85 NS/NT）在此模式下均作为受保护胚系背景归入 Protected（D-GREEN），避免胚系背景掩盖真正的 CDR 风险。\n2. + FR-Loop（开启扩展开关，全面环区分析）：\n   • 将环区范围扩展为 [CDR-Loop,Exp] ∪ [FR-Loop,Exp]，把 Lefranc (2003) 文献定义的 5 个框架区转向环（AB-turn 14–17、CC'-turn 44–47、C''D-turn 71–74、DE-turn/HV4 82–85、EF-turn 95–97）中处于 3D 表面暴露的位点一并纳入 Tier 2/3/4 风险统计。`}
              formula="Default: isLoop = (Tag == CDR-Loop) · Extended: isLoop = (Tag ∈ {CDR-Loop, FR-Loop})"
              example="例如：人源 IGHV3 抗体普遍携带 `74@IMGT82(NS)[FR-Loop,Exp]`（FR3 DE-turn/HV4）。在默认 CDR-Loop Only 模式下，它被归为 Protected（D-GREEN），重链 Clean Rate 高达 ~45%+；切换至 + FR-Loop 模式后，该位点作为暴露框架环被纳入 Tier 3 Moderate Risk（AMBER）进行全面审视。"
              align="right"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowTierMatrix(v => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-200 bg-white text-surface-700 hover:bg-surface-50 transition-colors"
          >
            {showTierMatrix ? 'Hide 4-Tier Gold Standard' : 'View 4-Tier Gold Standard'}
          </button>

          {isTap && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-surface-100 p-1 rounded-lg border border-surface-200">
                {[
                  { id: 'VHVL', label: 'VH+VL (Whole Fv)' },
                  { id: 'VH', label: 'VH Chain' },
                  { id: 'VL', label: 'VL Chain' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTapChain(opt.id as any)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      tapChain === opt.id
                        ? 'bg-white text-surface-900 font-semibold shadow-2xs'
                        : 'text-surface-600 hover:text-surface-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <InfoTooltip
                title="PTM Chain Scope Selector (切换 Whole Fv / VH 重链 / VL 轻链 PTM 统计)"
                summary="切换统计整株抗体双链并集（VH+VL Whole Fv）、仅重链（VH Chain）或仅轻链（VL Chain）的 4-Tier PTM 风险占比与 IMGT 热点排行榜。"
                method={`• VH+VL (Whole Fv)：对同一抗体的 VH 与 VL 位点求并集（Union），只要任一条链存在 Tier k 风险，整株分子即计入该风险，反映整株候选分子的综合 CMC 合规率；\n• VH Chain：仅统计重链可变区上的 PTM 位点与 IMGT 热点；\n• VL Chain：仅统计轻链可变区上的 PTM 位点与 IMGT 热点。`}
                formula="P_tier(VHVL) = P(Tier ∈ VH ∪ Tier ∈ VL) ≥ max(P_tier(VH), P_tier(VL))"
                example="例如：在临床单抗库中，单独看 VL Chain 时 Clean Molecules 占比显著高于 VH Chain，而合并为 VH+VL (Whole Fv) 时要求两条链同时无 Tier 1/2/3 位点。"
                align="right"
              />
            </div>
          )}
        </div>
      </div>

      {/* Collapsible 4-Tier Gold Standard Reference Table */}
      {showTierMatrix && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[680px]">
            <thead>
              <tr className="bg-surface-100 text-surface-700 font-semibold border-b border-surface-200">
                <th className="py-2.5 px-4 w-[18%]">Tier</th>
                <th className="py-2.5 px-4 w-[24%]">Type</th>
                <th className="py-2.5 px-4 w-[34%]">Amino acid &amp; Structural Condition</th>
                <th className="py-2.5 px-4 w-[24%]">Active Tag &amp; Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              <tr>
                <td className="py-2.5 px-4 font-bold text-rose-700">Tier 1 · Intolerable</td>
                <td className="py-2.5 px-4 text-surface-700">Free Cys; N-glycosylation</td>
                <td className="py-2.5 px-4 font-mono text-surface-800">C (unpaired Sγ–Sγ &gt; 3.0 Å); Nx[ST] except for NP[ST]</td>
                <td className="py-2.5 px-4 font-mono text-rose-600 font-semibold">RED · Any position</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold text-rose-600">Tier 2 · High risk</td>
                <td className="py-2.5 px-4 text-surface-700">Isomerization; Deamidation; Oxidation</td>
                <td className="py-2.5 px-4 font-mono text-surface-800">NG &amp; DG; exposed &amp; in loops</td>
                <td className="py-2.5 px-4 font-mono text-rose-600 font-semibold">RED · {loopScopeTagText}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold text-amber-700">Tier 3 · Moderate risk</td>
                <td className="py-2.5 px-4 text-surface-700">Isomerization; Deamidation; Oxidation</td>
                <td className="py-2.5 px-4 font-mono text-surface-800">M, W, NS, NT, NN, NH, DS, DD; exposed &amp; in loops</td>
                <td className="py-2.5 px-4 font-mono text-amber-700 font-semibold">AMBER · {loopScopeTagText}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold text-emerald-700">Tier 4 · Low risk</td>
                <td className="py-2.5 px-4 text-surface-700">Isomerization; Deamidation; Oxidation</td>
                <td className="py-2.5 px-4 font-mono text-surface-800">Nx Dx not mentioned above (incl. NP, DP); exposed &amp; in loops</td>
                <td className="py-2.5 px-4 font-mono text-emerald-700 font-semibold">L-GREEN · {loopScopeTagText}</td>
              </tr>
              <tr className="bg-surface-50/60">
                <td className="py-2.5 px-4 font-bold text-surface-600">Protected / Shielded</td>
                <td className="py-2.5 px-4 text-surface-600">3D β-Strand or Buried Core</td>
                <td className="py-2.5 px-4 font-mono text-surface-600">
                  [CDR-Strand,*] / [FR-Strand,*] / [*,Buried]{!includeFrLoops ? ' / [FR-Loop,*]' : ''}
                </td>
                <td className="py-2.5 px-4 font-mono text-surface-500 font-semibold">D-GREEN · Protected</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 4-Column KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-surface-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-surface-500 mb-1">
            <span className="font-semibold text-rose-700">Tier 1 · Intolerable ({selectedChain})</span>
            <InfoTooltip
              title={`Tier 1 · Intolerable Risk (${chainLabelText} · RED)`}
              summary={
                selectedChain === 'VHVL'
                  ? '统计当前筛选队列中，完整 Fv（VH 或 VL 任一链）携带未配对游离半胱氨酸（Free Cys）或潜在 N-糖基化位点（Nx[ST] except for NP[ST]）的抗体占比。'
                  : selectedChain === 'VH'
                  ? '统计仅在重链可变区（VH Chain）上携带未配对游离 Cys 或重链 N-糖基化位点（Nx[ST] except for NP[ST]）的抗体占比。'
                  : selectedChain === 'VL'
                  ? '统计仅在轻链可变区（VL Chain）上携带未配对游离 Cys 或轻链 N-糖基化位点（Nx[ST] except for NP[ST]）的抗体占比。'
                  : '统计单域纳米抗体（VHH）中携带未配对游离 Cys（成对二硫键 Sγ–Sγ ≤ 3.0 Å 不计入风险）或可变区 N-糖基化位点的比例。'
              }
              method={
                selectedChain === 'VHVL'
                  ? '对每株抗体的 VH 与 VL 进行联合判定：只要 VH 或 VL 任一链存在 3D 未配对游离 Cys（Free: Yes）或 Count(N[^P][ST]) > 0，该抗体即计入 Whole Fv 的 Tier 1 Intolerable 分子数。'
                  : `扫描 ${chainLabelText} 3D 结构与序列：(1) 3D 结构中存在未配对游离半胱氨酸（Sγ–Sγ > 3.0 Å）；或 (2) 序列中存在 N[^P][ST] 糖基化三肽基序。`
              }
              formula={
                selectedChain === 'VHVL'
                  ? 'Tier1(VHVL) = Tier1(VH) ∨ Tier1(VL) → Flag: RED'
                  : `Tier1(${selectedChain}) = (Free_Cys_${selectedChain} == Yes) ∨ (NGlyc_${selectedChain} > 0) → Flag: RED`
              }
              example={
                selectedChain === 'VHVL'
                  ? '例如：Cetuximab 在重链携带糖基化位点，即使其 VL 链无糖基化且无游离 Cys，在 VH+VL 视图下仍计入 Tier 1（RED）。'
                  : selectedChain === 'VH'
                  ? '例如（VH 实例）：重链 CDRH2 `55@IMGT60(NYS)[CDR-Loop,Exp]` 或未配对 `102@IMGT110(C)[CDR-Loop,Exp]`（Free: Yes）触发重链 Tier 1 RED。'
                  : selectedChain === 'VL'
                  ? '例如（VL 实例）：轻链 CDRL1 `28@IMGT29(NGS)[CDR-Loop,Exp]` 触发轻链 Tier 1 RED。'
                  : '例如（VHH 实例）：VHH 若含 4 个 Cys 且在 3D 结构中形成 2 对二硫键（`4 (Free: No)`）则不计入 Tier 1；若含未配对 Cys（`Free: Yes`）则计入 Tier 1 RED。'
              }
            />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-surface-900">
            {ts.intolerablePercent ?? 0}%
            <span className="text-xs font-normal text-surface-400 ml-2">({ts.intolerableCount ?? 0}/{total})</span>
          </div>
          <div className="mt-2 pt-2 border-t border-surface-100 text-[11px] text-surface-500 font-mono tabular-nums flex justify-between">
            <span>Free Cys: {ts.freeCysCount ?? 0}</span>
            <span>N-Glyc: {ts.nGlycCount ?? 0}</span>
          </div>
        </div>

        <div className="bg-white border border-surface-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-surface-500 mb-1">
            <span className="font-semibold text-rose-600">Tier 2 · High Risk ({selectedChain})</span>
            <InfoTooltip
              title={`Tier 2 · High Risk ${loopScopeTagText} (${chainLabelText} · RED)`}
              summary={
                selectedChain === 'VHVL'
                  ? `统计在完整 Fv（VH 或 VL 任一链的暴露环区 ${loopScopeTagText}）携带高风险脱酰胺基序（NG）或高风险异构化基序（DG）的抗体占比。`
                  : selectedChain === 'VH'
                  ? `统计仅在重链可变区（VH Chain）的暴露环区 ${loopScopeTagText} 携带 NG 或 DG 的抗体占比。`
                  : selectedChain === 'VL'
                  ? `统计仅在轻链可变区（VL Chain）的暴露环区 ${loopScopeTagText} 携带 NG 或 DG 的抗体占比。`
                  : `统计单域纳米抗体（VHH）暴露环区 ${loopScopeTagText} 携带 NG 或 DG 的占比。`
              }
              method={`严格按照金标准表定义：在 ${chainLabelText} 范围内，位点必须同时满足：(1) 基序为 NG 或 DG；(2) 处于当前激活的 3D 环区范围（${loopScopeDescText}）；(3) 反应残基 N 或 D 自身的 PSA 侧链相对溶剂可及性 side_rsa ≥ 7.5%（Exp）。`}
              formula={`Tier2(${selectedChain}) = Motif ∈ {NG, DG} ∧ Tag ∈ ${loopScopeTagText} → Flag: RED`}
              example={
                selectedChain === 'VHVL'
                  ? '例如：某抗体携带 `VH:54@IMGT59(NG)[CDR-Loop,Exp]` → 因重链 NG 处于暴露环区，Whole Fv 计入 Tier 2 High Risk（底部拆分为 Loop NG 与 Loop DG 分子数）。'
                  : selectedChain === 'VH'
                  ? '例如（VH 实例）：`54@IMGT59(NG)[CDR-Loop,Exp]`（重链 CDRH2 暴露环 NG）或 `99@IMGT108(DG)[CDR-Loop,Exp]`（重链 CDRH3 暴露环 DG）计入 VH Tier 2 RED。'
                  : selectedChain === 'VL'
                  ? '例如（VL 实例）：`28@IMGT29(NG)[CDR-Loop,Exp]`（轻链 CDRL1 暴露环 NG）或 `92@IMGT108(DG)[CDR-Loop,Exp]`（轻链 CDRL3 暴露环 DG）计入 VL Tier 2 RED。'
                  : '例如（VHH 实例）：`54@IMGT59(NG)[CDR-Loop,Exp]` 或 `104@IMGT111(DG)[CDR-Loop,Exp]` 计入 VHH Tier 2 RED。'
              }
            />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-surface-900">
            {ts.highRiskPercent ?? 0}%
            <span className="text-xs font-normal text-surface-400 ml-2">({ts.highRiskCount ?? 0}/{total})</span>
          </div>
          <div className="mt-2 pt-2 border-t border-surface-100 text-[11px] text-surface-500 font-mono tabular-nums flex justify-between">
            <span>Loop NG: {ts.highNgCount ?? 0}</span>
            <span>Loop DG: {ts.highDgCount ?? 0}</span>
          </div>
        </div>

        <div className="bg-white border border-surface-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-surface-500 mb-1">
            <span className="font-semibold text-amber-700">Tier 3 · Moderate ({selectedChain})</span>
            <InfoTooltip
              title={`Tier 3 · Moderate Risk ${loopScopeTagText} (${chainLabelText} · AMBER)`}
              summary={
                selectedChain === 'VHVL'
                  ? `统计在完整 Fv（VH 或 VL 任一链的暴露环区 ${loopScopeTagText}）携带氧化位点（M, W）、中度脱酰胺位点（NS, NT, NN, NH）或中度异构化位点（DS, DD）的抗体占比。`
                  : selectedChain === 'VH'
                  ? `统计仅在重链可变区（VH Chain）的暴露环区 ${loopScopeTagText} 携带 M, W, NS, NT, NN, NH, DS, DD 的抗体占比。`
                  : selectedChain === 'VL'
                  ? `统计仅在轻链可变区（VL Chain）的暴露环区 ${loopScopeTagText} 携带 M, W, NS, NT, NN, NH, DS, DD 的抗体占比。`
                  : `统计单域纳米抗体（VHH）暴露环区 ${loopScopeTagText} 携带 M, W, NS, NT, NN, NH, DS, DD 的占比。`
              }
              method={`严格按照金标准表定义：在 ${chainLabelText} 范围内，位点必须同时满足：(1) 基序属于 {M, W, NS, NT, NN, NH, DS, DD}；(2) 处于当前激活的 3D 环区范围（${loopScopeDescText}）；(3) 反应残基自身的 PSA side_rsa ≥ 7.5%（Exp）。注：处于 β-折叠股（如 CDR1 尾端茎部 IMGT 37–38 的 W38/M38、FR2 核心 W41/M39、FR3 E-股 M91、FR4 锚点 W118）或包埋态的位点均自动归入 Protected（D-GREEN）。`}
              formula={`Tier3(${selectedChain}) = Motif ∈ {M, W, NS, NT, NN, NH, DS, DD} ∧ Tag ∈ ${loopScopeTagText} → AMBER`}
              example={
                selectedChain === 'VHVL'
                  ? '例如：某抗体含有重链 `VH:100@IMGT109(W)[CDR-Loop,Exp]` 或轻链 `VL:31@IMGT32(NS)[CDR-Loop,Exp]` → 计入暴露环区 Tier 3 AMBER。'
                  : selectedChain === 'VH'
                  ? '例如（VH 实例）：`100@IMGT109(W)[CDR-Loop,Exp]`（重链 CDRH3 暴露环 W）或 `55@IMGT60(NS)[CDR-Loop,Exp]`（重链 CDRH2 暴露环 NS）计入 VH Tier 3 AMBER。'
                  : selectedChain === 'VL'
                  ? '例如（VL 实例）：`31@IMGT32(NS)[CDR-Loop,Exp]`（轻链 CDRL1 暴露环 NS）或 `91@IMGT107(W)[CDR-Loop,Exp]`（轻链 CDRL3 暴露环 W）计入 VL Tier 3 AMBER。'
                  : '例如（VHH 实例）：`103@IMGT110(W)[CDR-Loop,Exp]` 或 `105@IMGT112(M)[CDR-Loop,Exp]` 计入 VHH Tier 3 AMBER。'
              }
            />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-surface-900">
            {ts.moderateRiskPercent ?? 0}%
            <span className="text-xs font-normal text-surface-400 ml-2">({ts.moderateRiskCount ?? 0}/{total})</span>
          </div>
          <div className="mt-2 pt-2 border-t border-surface-100 text-[11px] text-surface-500 font-mono tabular-nums flex justify-between">
            <span>Loop M/W: {(ts.modLoopWCount ?? 0) + (ts.modExpMCount ?? 0)}</span>
            <span>Loop NS..DD: {(ts.modLoopDeamCount ?? 0) + (ts.modLoopIsomCount ?? 0)}</span>
          </div>
        </div>

        <div className="bg-white border border-surface-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-surface-500 mb-1">
            <span className="font-semibold text-emerald-700">Tier 4 · Low Risk &amp; Clean ({selectedChain})</span>
            <InfoTooltip
              title={`Tier 4 · Low Risk (L-GREEN) & Clean Rate (${chainLabelText})`}
              summary={
                selectedChain === 'VHVL'
                  ? '大字百分比展示整株抗体双链（VH 与 VL 同时）完全不含 Tier 1/2/3 中高危风险的洁净分子（Clean Fv Molecules）占比；底部展示在暴露环区携带 Tier 4 Low Risk（未列入前述等级的其他 Nx / Dx 基序，含 NP 与 DP）的分子占比。'
                  : selectedChain === 'VH'
                  ? '大字百分比展示仅在重链可变区（VH Chain）完全不含 Tier 1/2/3 中高危风险的洁净重链占比；底部展示在重链暴露环区携带 Tier 4 Low Risk（其他 15 种 Nx 与 17 种 Dx）的重链占比。'
                  : selectedChain === 'VL'
                  ? '大字百分比展示仅在轻链可变区（VL Chain）完全不含 Tier 1/2/3 中高危风险的洁净轻链占比；底部展示在轻链暴露环区携带 Tier 4 Low Risk（其他 15 种 Nx 与 17 种 Dx）的轻链占比。'
                  : '大字百分比展示单域纳米抗体（VHH）完全不含 Tier 1/2/3 中高危风险的洁净分子占比；底部展示在 VHH 暴露环区携带 Tier 4 Low Risk（其他 Nx / Dx）的分子占比。'
              }
              method={`在 ${chainLabelText} 范围内：\n1. Clean Molecules (D-GREEN/L-GREEN)：该链（或双链同时）没有任何 Tier 1、Tier 2 或 Tier 3 位点；\n2. Tier 4 Low Risk (L-GREEN)：未列入 Tier 2/3 的其余全部 15 种 Nx（含 NP）以及其余全部 17 种 Dx（含 DP, DT, DH），当且仅当位于当前激活的暴露环区（${loopScopeTagText}）时计入 Tier 4。`}
              formula={`Clean(${selectedChain}) = ¬Tier1(${selectedChain}) ∧ ¬Tier2(${selectedChain}) ∧ ¬Tier3(${selectedChain})`}
              example={
                selectedChain === 'VHVL'
                  ? '例如：某单抗 VH 仅含 `VH:31@IMGT32(NY)[CDR-Loop,Exp]`（Tier 4 L-GREEN），VL 仅含保护态位点（D-GREEN）→ 该抗体在 Whole Fv 视图下属于 Clean Molecule，同时计入底部 Other Nx/Dx Loop。'
                  : selectedChain === 'VH'
                  ? '例如（VH 实例）：重链 CDRH1 `31@IMGT32(NY)[CDR-Loop,Exp]` 或 CDRH3 `99@IMGT108(DP)[CDR-Loop,Exp]` 归为 VH Tier 4 Low Risk（L-GREEN）。'
                  : selectedChain === 'VL'
                  ? '例如（VL 实例）：轻链 CDRL1 `30@IMGT31(NY)[CDR-Loop,Exp]` 或 CDRL3 `93@IMGT109(DF)[CDR-Loop,Exp]` 归为 VL Tier 4 Low Risk（L-GREEN）。'
                  : '例如（VHH 实例）：VHH CDR3 `101@IMGT108(NY)[CDR-Loop,Exp]` 归为 VHH Tier 4 Low Risk（L-GREEN）。'
              }
            />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-surface-900">
            {ts.lowRiskOnlyPercent ?? 0}%
            <span className="text-xs font-normal text-surface-400 ml-2">({ts.lowRiskOnlyCount ?? 0}/{total} clean)</span>
          </div>
          <div className="mt-2 pt-2 border-t border-surface-100 text-[11px] text-surface-500 font-mono flex justify-between">
            <span>Other Nx/Dx Loop: {ts.lowRiskPercent ?? 0}% ({ts.lowRiskCount ?? 0})</span>
          </div>
        </div>
      </div>

      {/* Dual-Column IMGT Hotspot Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Actionable Exposed Loop Hotspots */}
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-surface-900 text-sm">
                Top Actionable Exposed Loop Hotspots ({selectedChain} · by IMGT Position)
              </h4>
              <InfoTooltip
                title={`IMGT Exposed Loop Hotspots · ${chainLabelText} (${loopScopeTagText})`}
                summary={
                  selectedChain === 'VHVL'
                    ? `将重链（VH）与轻链（VL）在当前环区范围（${loopScopeDescText}）内的所有表面暴露环区风险位点（Tier 1/2/3）放在同一全局榜单中按出现频率降序排列。`
                    : selectedChain === 'VH'
                    ? `仅针对重链可变区（VH Chain），按标准化 IMGT 编号位置聚合统计在当前环区范围（${loopScopeDescText}）内出现频率最高的暴露环区风险位点。`
                    : selectedChain === 'VL'
                    ? `仅针对轻链可变区（VL Chain），按标准化 IMGT 编号位置聚合统计在当前环区范围（${loopScopeDescText}）内出现频率最高的暴露环区风险位点。`
                    : `针对单域纳米抗体（VHH），按标准化 IMGT 编号位置聚合统计在当前环区范围（${loopScopeDescText}）内出现频率最高的暴露环区风险位点。`
                }
                method={`解析当前筛选队列中 ${chainLabelText} 的所有 PTM 位点标签 \`linearPos@IMGTpos(Motif)[Region-SecStruct,Exp]\`，筛选满足 Tier 1/2/3 风险条件的活跃位点（${loopScopeTagText}），按 \`(Chain, IMGT_Position, Motif)\` 唯一键聚类计数，并统计该 IMGT 位点在不同抗体中对应的线性序列位置范围（Lin: min–max）。`}
                formula="Prevalence (%) = (携带该 IMGT+Motif 暴露环风险位点的抗体数 / 当前队列总数 N) × 100%"
                example={
                  selectedChain === 'VHVL'
                    ? '例如：在 Whole Fv 综合榜中，默认模式下聚焦重链与轻链 CDR-Loop 上的高频脱酰胺/异构化/氧化位点；开启 + FR-Loop 后还会展示重链 `VH · IMGT82 (NS)`（FR3 DE-turn）等暴露框架环位点。'
                    : selectedChain === 'VH'
                    ? '例如（VH 典型热点）：`VH · IMGT59 (NG)`（位于 CDRH2 环顶）与 `VH · IMGT109 (W)`（位于 CDRH3 环顶）是重链 CDR 环上的典型高频热点。'
                    : selectedChain === 'VL'
                    ? '例如（VL 典型热点）：`VL · IMGT31 (NS)` / `VL · IMGT30 (NG)`（位于 CDRL1 环）与 `VL · IMGT107 (W)`（位于 CDRL3 环）是轻链最高频的暴露环风险位点。'
                    : '例如（VHH 典型热点）：`VHH · IMGT59 (NG)`（CDR2）与 `VHH · IMGT110 (W)`（CDR3）是纳米抗体最常见的暴露环位点。'
                }
                align="left"
              />
            </div>
            <span className="text-xs font-mono text-rose-600 font-semibold">{loopScopeTagText}</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50/70 text-surface-500 font-semibold">
                  <th className="py-2.5 px-4">IMGT Position &amp; Motif</th>
                  <th className="py-2.5 px-4">Region &amp; Linear Range</th>
                  <th className="py-2.5 px-4">Tier</th>
                  <th className="py-2.5 px-4 text-right">Prevalence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 font-mono">
                {(chainStats?.cdrHotspots || []).map((h: any) => (
                  <tr key={h.key} className="hover:bg-surface-50/70">
                    <td className="py-2 px-4 font-semibold text-surface-900 whitespace-nowrap">
                      <span className="text-brand-600">{h.chain}</span> · {h.imgtPos} ({h.motif})
                    </td>
                    <td className="py-2 px-4 font-sans text-surface-600 whitespace-nowrap">
                      <span className="font-medium text-surface-800">{h.subRegion}</span>
                      <span className="mx-1.5 text-surface-300">·</span>
                      <span className="font-mono text-[11px] text-surface-500">Lin: {h.linearRange}</span>
                    </td>
                    <td className="py-2 px-4 whitespace-nowrap">
                      <span className={`font-semibold ${h.tier === 'Intolerable' || h.tier === 'High' ? 'text-rose-600' : 'text-amber-600'}`}>
                        {h.tier === 'Intolerable' || h.tier === 'High' ? 'RED' : 'AMBER'}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-surface-800 whitespace-nowrap">
                      <span className="font-semibold">{h.percent}%</span>{' '}
                      <span className="text-surface-400">(n={h.count})</span>
                    </td>
                  </tr>
                ))}
                {(!chainStats?.cdrHotspots || chainStats.cdrHotspots.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-surface-400 font-sans">
                      No exposed loop hotspots in this filtered cohort.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Conserved Framework / Buried Landmarks */}
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-surface-900 text-sm">
                Top Protected β-Strand &amp; Buried Landmarks ({selectedChain} · by IMGT Position)
              </h4>
              <InfoTooltip
                title={`Protected β-Strand & Buried Landmarks · ${chainLabelText}`}
                summary={
                  selectedChain === 'VHVL'
                    ? '汇总展示双链 Fv（VH 与 VL）中高频出现在刚性 β-折叠股（[FR-Strand,*] / [CDR-Strand,*]）或疏水核心内部包埋（[*,Buried]）的结构保护态基序（D-GREEN，严格不含 Tier 4 Low Risk 暴露环位点）。'
                    : selectedChain === 'VH'
                    ? '专门展示重链可变区（VH Chain）中的保守结构保护地标。涵盖重链核心色氨酸 `VH · IMGT41 (W)`、CDR1 茎部色氨酸 `VH · IMGT38 (W)`、FR2 界面色氨酸 `VH · IMGT52 (W)`、FR4 锚定色氨酸 `VH · IMGT118 (W)` 以及疏水核心甲硫氨酸 `VH · IMGT39/91 (M)`。'
                    : selectedChain === 'VL'
                    ? '专门展示轻链可变区（VL Chain）中的保守结构保护地标。涵盖轻链核心二硫键旁色氨酸 `VL · IMGT41 (W)`、CDR1 茎部甲硫氨酸 `VL · IMGT37/38 (M)` 以及疏水核心残基。'
                    : '专门展示单域纳米抗体（VHH）中的保守结构保护地标，包括核心色氨酸 `VHH · IMGT41 (W)`、`VHH · IMGT118 (W)` 及疏水核心甲硫氨酸 `VHH · IMGT39/91 (M)`。'
                }
                method={`严格筛选 ${chainLabelText} 中 \`tier === 'Protected'\` 的结构保护位点（即位于 3D β-折叠股 \`[FR-Strand,*]\` / \`[CDR-Strand,*]\` 或内部包埋 \`[*,Buried]\` 的基序；在默认 CDR-Loop Only 模式下亦包含受保护的框架区位点），按 \`(Chain, IMGT_Position, Motif)\` 聚合统计出现频率与线性位置区间。`}
                formula="Protected Condition: (SecStruct == Strand) ∨ (Exposure == Buried) → Non-Risk (D-GREEN)"
                example={
                  selectedChain === 'VHVL'
                    ? '例如：在 Whole Fv 保护榜中，`VH · IMGT41 (W)`、`VL · IMGT41 (W)` 与 `VH · IMGT118 (W)` 的出现率均接近 99%–100%，证明本系统能够精准识别并豁免临床抗体的保守骨架残基。'
                    : selectedChain === 'VH'
                    ? '例如（VH 专属地标）：`VH · IMGT41 (W)`（线性约 36 位）、`VH · IMGT118 (W)`（WGQGT 锚点）、`VH · IMGT91 (M)`（FR3 E-股疏水核心），切勿对其做去风险突变！'
                    : selectedChain === 'VL'
                    ? '例如（VL 专属地标）：`VL · IMGT41 (W)`（WYQQK 保守基序，线性约 34–35 位），突变将导致轻链聚集或丧失表达。'
                    : '例如（VHH 专属地标）：`VHH · IMGT41 (W)` 与 `VHH · IMGT118 (W)` 是维持 VHH 单域独立折叠的核心支柱。'
                }
                align="right"
              />
            </div>
            <span className="text-xs font-mono text-emerald-700 font-semibold">Protected · D-GREEN</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50/70 text-surface-500 font-semibold">
                  <th className="py-2.5 px-4">IMGT Position &amp; Motif</th>
                  <th className="py-2.5 px-4">Structural Role &amp; Linear Range</th>
                  <th className="py-2.5 px-4 text-right">Prevalence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 font-mono">
                {(chainStats?.frConservedSites || []).map((s: any) => (
                  <tr key={s.key} className="hover:bg-surface-50/70">
                    <td className="py-2 px-4 font-semibold text-surface-900 whitespace-nowrap">
                      <span className="text-surface-600">{s.chain}</span> · {s.imgtPos} ({s.motif}){' '}
                      <span className="text-[11px] text-emerald-700">[{s.tag}]</span>
                    </td>
                    <td className="py-2 px-4 font-sans text-surface-600">
                      <div className="text-surface-800 truncate max-w-[260px]" title={s.note}>{s.note}</div>
                      <div className="font-mono text-[11px] text-surface-400">Lin: {s.linearRange}</div>
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-surface-800 whitespace-nowrap">
                      <span className="font-semibold">{s.percent}%</span>{' '}
                      <span className="text-surface-400">(n={s.count})</span>
                    </td>
                  </tr>
                ))}
                {(!chainStats?.frConservedSites || chainStats.frConservedSites.length === 0) && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-surface-400 font-sans">
                      No protected framework sites in this filtered cohort.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Motif Summary Table */}
      {chainStats?.motifSummary && chainStats.motifSummary.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-surface-900 text-sm">
                Motif-Level Cohort Distribution ({selectedChain} · N = {total})
              </h4>
              <InfoTooltip
                title={`Exposed Loop vs. Protected Motif Prevalence · ${chainLabelText}`}
                summary={`在 ${chainLabelText} 范围内，按四级风险体系金标准基序（Free Cys, Nx[ST], NG, DG, M, W, NS, NT, NN, NH, DS, DD, Other Nx [含 NP], Other Dx [含 DP]）逐行对比其在活跃暴露环区（${loopScopeTagText}）与结构保护区（Protected β-Strand / Buried）中的分布比例。`}
                method={`对 ${chainLabelText} 中的每种基序分别统计：(1) 至少携带 1 个处于当前激活暴露环区（${loopScopeTagText}）的该基序的抗体数量与百分比；(2) 仅在 β-折叠股或内部包埋位置携带该基序的抗体数量与百分比；(3) 右侧列展示全队列在 ${selectedChain} 上该基序处于活跃暴露环态的位点总数 / 检出总位点数。`}
                formula={`Active_Ratio(${selectedChain}) = Active_Occurrences(${selectedChain}) / Total_Occurrences(${selectedChain})`}
                example={
                  selectedChain === 'VHVL'
                    ? '例如在 Whole Fv (VH+VL) 中：每株抗体平均携带 3–4 个色氨酸 W（含 VH W41/W118 与 VL W41），因此 Protected W 抗体占比达 100%，但仅有暴露在环区上的 W 才计入 Active Exposed & in Loops 列。'
                    : selectedChain === 'VH'
                    ? '例如在 VH Chain 中：每条重链含有保守核心 W41 与 W118（部分含 W38/W52），且常含有疏水核心 M39/M91，对比 Active 与 Protected 列可直观看出 3D 结构过滤排除了超过 75% 的重链假阳性位点。'
                    : selectedChain === 'VL'
                    ? '例如在 VL Chain 中：每条轻链含有保守核心 W41（FR4 118 位为 F 而非 W），因此轻链上检出的 W 总数明显少于重链，且一旦出现在 CDRL3 环顶（如 IMGT107 W）即为活跃暴露态。'
                    : '例如在 VHH 中：核心 W41 与 W118 归入 Protected 列，而 CDR3 环顶的暴露 W/M/NG/DG 归入 Active Exposed & in Loops 列。'
                }
                align="left"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50/70 text-surface-500 font-semibold">
                  <th className="py-2.5 px-4">Motif</th>
                  <th className="py-2.5 px-4">Pathway</th>
                  <th className="py-2.5 px-4">Tier Rule</th>
                  <th className="py-2.5 px-4">
                    <div className="inline-flex items-center gap-1">
                      <span>Exposed &amp; in Loops ({loopScopeTagText})</span>
                      <InfoTooltip
                        title={`Exposed & in Loops (${loopScopeTagText}) · Antibody Prevalence & Site Count`}
                        summary={`统计在当前队列中，至少携带 1 个处于活跃暴露环区（${loopScopeTagText}）的该基序的【抗体分子数（mAbs/VHHs）】及其占总队列百分比，同时列出这些抗体上检出的【活跃暴露环位点总数（sites）】。`}
                        method="• 分子数（mAbs/VHHs，按抗体去重）：若同一株抗体同时携带 2 个或以上暴露环区 NG/W/Other Nx 位点，该抗体在分子计数中仅计为 1 株；\n• 位点数（sites，按残基位点累加）：将该抗体上的所有暴露环位点逐一累加，数值与最右侧「Active / Total Sites」列中的分子（Active Sites）完全相等。"
                        formula="Prevalence (%) = (Active_Antibodies / Cohort_N) × 100% · Active_Sites ≥ Active_Antibodies"
                        example="例如：若有 100 株抗体携带暴露环区 W，其中 25 株抗体各自携带 2 个暴露环区 W，则分子数为 100 mAbs，而活跃暴露位点总数（Active Sites）为 75×1 + 25×2 = 125 sites。"
                      />
                    </div>
                  </th>
                  <th className="py-2.5 px-4">
                    <div className="inline-flex items-center gap-1">
                      <span>Protected (β-Strand / Buried)</span>
                      <InfoTooltip
                        title="Protected (β-Strand / Buried) · Antibody Prevalence & Site Count"
                        summary="统计在当前队列中，携带至少 1 个位于刚性 β-折叠股（[FR-Strand,*] / [CDR-Strand,*]）或内部疏水核心包埋（[*,Buried]）的结构保护态基序的【抗体分子数（mAbs/VHHs）】与【受保护位点总数（sites）】。"
                        method="• 分子数（mAbs/VHHs，按抗体去重）：只要抗体含有 ≥ 1 个受保护态的该基序即计为 1 株；\n• 位点数（sites，按残基位点累加）：等于 Total Sites 减去 Active Sites。由于每株抗体的重链和轻链通常同时含有多个保守骨架残基（如 VH W41、VH W118、VL W41 共 3–4 个保护态 W），受保护位点总数（sites）通常显著大于抗体分子数（mAbs）。"
                        formula="Protected_Sites = Total_Sites − Active_Sites"
                        example="例如：在 N = 1,095 株单抗的 Whole Fv 中，几乎每株抗体都携带 3–4 个保守骨架色氨酸（W41/W118），因此受保护分子数约为 1,095 mAbs（100%），而受保护位点总数高达 3,500+ sites。"
                      />
                    </div>
                  </th>
                  <th className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>Active / Total Sites</span>
                      <InfoTooltip
                        title="Active Sites / Total Detected Sites (位点级活跃数 / 总位点数)"
                        summary="从【单个氨基酸位点（Site-level occurrences）】维度统计：全队列所有抗体上检出的「活跃暴露环位点总数（Active Sites）」占「该基序检出总位点数（Total Sites = Active Sites + Protected Sites）」的比例。"
                        method="为什么过去看起来 Active 数值大于第 4 列括号里的数字？\n因为第 4 列括号内原先仅显示了【携带该风险的抗体株数（Antibody Count，按分子去重）】，而本列显示的是【位点总个数（Site Count，不去重累加）】。当单株抗体在同一条链或重轻双链上携带 ≥ 2 个相同基序（如 2 个暴露 W 或 3 个暴露 Other Nx）时，1 株抗体会贡献多个 Active Sites。现在第 4 列与第 5 列已同时标明 `mAbs`（分子株数）与 `sites`（位点个数），第 4 列的 `sites` 与本列的 `Active` 完全相等！"
                        formula="Total_Sites = Active_Sites (第4列 sites) + Protected_Sites (第5列 sites)"
                        example="例如：某基序在全队列中共检出 Total = 500 sites，其中位于暴露环区的 Active = 180 sites（分布于 150 mAbs 中），位于 β-股或包埋区的 Protected = 320 sites → 本列显示 `180 / 500 sites (36.0%)`。"
                        align="right"
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 font-mono">
                {chainStats.motifSummary.map((item: any) => {
                  const protectedSites = Math.max(0, (item.totalOccurrences || 0) - (item.activeOccurrences || 0));
                  const siteActivePct =
                    item.totalOccurrences > 0
                      ? Math.round((item.activeOccurrences / item.totalOccurrences) * 1000) / 10
                      : 0;
                  const molUnit = isTap ? 'mAbs' : 'VHHs';
                  return (
                    <tr key={item.motif} className="hover:bg-surface-50/70">
                      <td className="py-2 px-4 font-semibold text-surface-900">{item.motif}</td>
                      <td className="py-2 px-4 font-sans text-surface-600">{item.category}</td>
                      <td className="py-2 px-4 font-sans text-surface-500">{item.tierRule}</td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-surface-100 rounded-full overflow-hidden shrink-0">
                            <div
                              className={`h-full ${
                                item.tierRule.includes('Intolerable') || item.tierRule.includes('High')
                                  ? 'bg-rose-500'
                                  : item.tierRule.includes('Low')
                                  ? 'bg-emerald-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, item.activePercent)}%` }}
                            />
                          </div>
                          <span className="font-semibold text-surface-900 tabular-nums whitespace-nowrap">
                            {item.activePercent}% ({item.activeAntibodyCount} {molUnit} · {item.activeOccurrences} sites)
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-surface-100 rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full bg-slate-400"
                              style={{ width: `${Math.min(100, item.conservedPercent)}%` }}
                            />
                          </div>
                          <span className="text-surface-600 tabular-nums whitespace-nowrap">
                            {item.conservedPercent}% ({item.conservedAntibodyCount} {molUnit} · {protectedSites} sites)
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums text-surface-700 whitespace-nowrap">
                        <span className="font-semibold text-surface-900">{item.activeOccurrences}</span> / {item.totalOccurrences} sites{' '}
                        <span className="text-[11px] text-surface-400">({siteActivePct}%)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
