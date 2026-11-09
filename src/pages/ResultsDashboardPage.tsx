import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  ReferenceLine,
  ReferenceArea,
  Brush,
  Cell,
  LabelList,
} from 'recharts';
import {
  ShieldAlert,
  ShieldCheck,
  Download,
  FileText,
  FlaskConical,
  Search,
  LayoutGrid,
  Maximize2,
  Activity,
} from 'lucide-react';
import { DetectionJobResult, FeatureValues } from '../types/ldos';
import { TimeFrequencyCanvas } from '../components/TimeFrequencyCanvas';
import { getDownloadUrl } from '../services/api';

interface ResultsDashboardPageProps {
  result: DetectionJobResult | null;
  onOpenReportModal: () => void;
  onGoToExperiments: () => void;
  onGoToConfigure: () => void;
}

const FEATURE_LABELS: Record<
  keyof FeatureValues,
  { title: string; shortTitle: string; unit: string; formula: string; paperFig: string; interpretation: string }
> = {
  entropy: {
    title: 'Time–Frequency Entropy (En)',
    shortTitle: 'Entropy (En)',
    unit: 'nats',
    formula: 'Eq. (3): En = -∑∑ P_ij log(P_ij)',
    paperFig: 'Wang et al., Fig. 4',
    interpretation: 'Lower in LDoS (LS=1) due to energy concentration in the low-frequency band.',
  },
  energy_ratio: {
    title: 'Low-Frequency Energy Ratio (RE)',
    shortTitle: 'Energy Ratio (RE)',
    unit: 'ratio [0,1]',
    formula: 'Eq. (4): RE = ∑∑_{1/5} M_ij² / ∑∑ M_ij²',
    paperFig: 'Wang et al., Fig. 5',
    interpretation: 'Significantly higher in LDoS (LS=1) as periodic bursts concentrate energy below fs/5.',
  },
  contrast: {
    title: 'Time–Frequency Contrast (Con)',
    shortTitle: 'Contrast (Con)',
    unit: 'intensity',
    formula: 'Eq. (5): Con = ∑∑ (i - j)² P_ij',
    paperFig: 'Wang et al., Fig. 6',
    interpretation: 'Higher in LDoS (LS=1) due to sharp local intensity transitions during attack pulses.',
  },
  correlation: {
    title: 'Time–Frequency Correlation (Cor)',
    shortTitle: 'Correlation (Cor)',
    unit: 'coeff',
    formula: 'Eq. (6): Cor = (∑∑ ij P_ij - μ1μ2) / (σ1σ2)',
    paperFig: 'Wang et al., Fig. 7',
    interpretation: 'Measures directional similarity across time-frequency slices between NS and LS.',
  },
  spectral_centroid: {
    title: 'Spectral Centroid (SC)',
    shortTitle: 'Spectral Centroid',
    unit: 'Hz',
    formula: 'SC = ∑ f_k S(f_k) / ∑ S(f_k)',
    paperFig: 'Extended Feature #5',
    interpretation: 'Shifts downward toward 0.5–1.0 Hz under periodic LDoS congestion.',
  },
  kurtosis: {
    title: 'Time-Domain Signal Kurtosis (Ku)',
    shortTitle: 'Kurtosis (Ku)',
    unit: 'moment',
    formula: 'Ku = E[(x - μ)⁴] / σ⁴',
    paperFig: 'Extended Feature #6',
    interpretation: 'Captures impulsive tail heaviness caused by high-rate short LDoS pulses.',
  },
};

export const ResultsDashboardPage: React.FC<ResultsDashboardPageProps> = ({
  result,
  onOpenReportModal,
  onGoToExperiments,
  onGoToConfigure,
}) => {
  const [timeSignalViewMode, setTimeSignalViewMode] = useState<'paper_split' | 'full_timeline' | 'dc_removed'>('paper_split');
  const [featureViewMode, setFeatureViewMode] = useState<'grid_all' | 'single_detail'>('grid_all');
  const [selectedFeatureTab, setSelectedFeatureTab] = useState<keyof FeatureValues>('energy_ratio');
  const [selectedWindowId, setSelectedWindowId] = useState<number | null>(null);
  const [windowFilter, setWindowFilter] = useState<'all' | 'ldos' | 'normal' | 'mismatch'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!result) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          No Detection Results Available Yet
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Configure your time-frequency transform and classifier parameters, then run the detection
          pipeline to view empirical evaluation metrics and scientific visualizations.
        </p>
        <button
          type="button"
          onClick={onGoToConfigure}
          className="px-4 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors cursor-pointer"
        >
          Go to Configuration
        </button>
      </div>
    );
  }

  const {
    jobId,
    datasetSummary,
    config,
    metrics,
    featureNames,
    featureSummaryByClass,
    windowPredictions,
    visualizations,
  } = result;

  const isLdosDetected = metrics.overallVerdict === 'LDOS_DETECTED';
  const activeFeatureKey = featureNames.includes(selectedFeatureTab)
    ? selectedFeatureTab
    : featureNames[0];

  const availableHeatmapWindows = Object.keys(visualizations.sampleWindowHeatmaps).map(Number);
  const inspectedHeatmap =
    selectedWindowId !== null && visualizations.sampleWindowHeatmaps[selectedWindowId]
      ? visualizations.sampleWindowHeatmaps[selectedWindowId]
      : null;

  // Prepare focused Normal vs LDoS zoomed signal slices (like Wang et al. Fig. 2a & Fig. 2b)
  const { normalZoomSlice, ldosZoomSlice, ldosIntervals } = useMemo(() => {
    const pts = visualizations.timeDomainSignal;
    const normPts = pts.filter((p) => (p.trueLabel ?? p.predictedLabel) === 0).slice(0, 65);
    const ldosPts = pts.filter((p) => (p.trueLabel ?? p.predictedLabel) === 1).slice(0, 65);

    const normSlice = (normPts.length > 5 ? normPts : pts.slice(0, 50)).map((p, idx) => ({
      sampleIdx: idx + 1,
      time: p.time,
      relTime: Number((idx * ((pts[1]?.time ?? 0.1) - (pts[0]?.time ?? 0))).toFixed(2)),
      amplitude: p.amplitude,
      dcRemoved: p.dcRemoved,
    }));

    const ldosSlice = (ldosPts.length > 5 ? ldosPts : pts.slice(-50)).map((p, idx) => ({
      sampleIdx: idx + 1,
      time: p.time,
      relTime: Number((idx * ((pts[1]?.time ?? 0.1) - (pts[0]?.time ?? 0))).toFixed(2)),
      amplitude: p.amplitude,
      dcRemoved: p.dcRemoved,
    }));

    // Compute contiguous LDoS time intervals for ReferenceArea shading on full timeline
    const intervals: { start: number; end: number }[] = [];
    let currentStart: number | null = null;
    for (const wp of windowPredictions) {
      if (wp.prediction === 1) {
        if (currentStart === null) currentStart = wp.startTime;
      } else {
        if (currentStart !== null) {
          intervals.push({ start: currentStart, end: wp.startTime });
          currentStart = null;
        }
      }
    }
    if (currentStart !== null && windowPredictions.length > 0) {
      intervals.push({
        start: currentStart,
        end: windowPredictions[windowPredictions.length - 1].endTime,
      });
    }

    return { normalZoomSlice: normSlice, ldosZoomSlice: ldosSlice, ldosIntervals: intervals };
  }, [visualizations.timeDomainSignal, windowPredictions]);

  // Compute 1D Marginal Frequency Spectrum from Normal vs LDoS heatmaps
  const marginalSpectrumData = useMemo(() => {
    const nMap = visualizations.normalHeatmap;
    const lMap = visualizations.ldosHeatmap;
    const freqs = nMap.frequencies;
    return freqs.map((fHz, fIdx) => {
      let nSum = 0;
      for (let t = 0; t < nMap.matrix.length; t++) {
        const v = nMap.matrix[t][fIdx] || 0;
        nSum += v * v;
      }
      let lSum = 0;
      for (let t = 0; t < lMap.matrix.length; t++) {
        const v = lMap.matrix[t][fIdx] || 0;
        lSum += v * v;
      }
      return {
        freqHz: fHz,
        normalEnergy: Number((nSum / Math.max(1, nMap.matrix.length)).toFixed(3)),
        ldosEnergy: Number((lSum / Math.max(1, lMap.matrix.length)).toFixed(3)),
      };
    });
  }, [visualizations.normalHeatmap, visualizations.ldosHeatmap]);

  // Build paired class-comparison series (Wang et al. Figs. 4-7: Index vs Normal Status & LDoS Status)
  const pairedFeatureComparisonByKey = useMemo(() => {
    const normalWins = windowPredictions.filter((w) => (w.trueLabel ?? w.prediction) === 0);
    const ldosWins = windowPredictions.filter((w) => (w.trueLabel ?? w.prediction) === 1);
    const maxLen = Math.max(normalWins.length, ldosWins.length, 1);

    const mapByKey: Record<
      string,
      {
        index: number;
        normalVal: number | null;
        ldosVal: number | null;
      }[]
    > = {};

    for (const fKey of featureNames) {
      const series = [];
      for (let i = 0; i < maxLen; i++) {
        series.push({
          index: i + 1,
          normalVal: normalWins[i] !== undefined ? Number((normalWins[i].features[fKey] ?? 0).toFixed(4)) : null,
          ldosVal: ldosWins[i] !== undefined ? Number((ldosWins[i].features[fKey] ?? 0).toFixed(4)) : null,
        });
      }
      mapByKey[fKey] = series;
    }
    return mapByKey;
  }, [windowPredictions, featureNames]);

  // Filter classification table rows
  const filteredPredictions = windowPredictions.filter((wp) => {
    if (windowFilter === 'ldos' && wp.prediction !== 1) return false;
    if (windowFilter === 'normal' && wp.prediction !== 0) return false;
    if (
      windowFilter === 'mismatch' &&
      (wp.trueLabel === null || wp.prediction === wp.trueLabel)
    ) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      return (
        String(wp.windowIndex + 1).includes(q) ||
        `${wp.startTime}s`.includes(q) ||
        (wp.prediction === 1 ? 'ldos' : 'normal').includes(q)
      );
    }
    return true;
  });

  // Feature trajectory data across chronological windows
  const featureTrajectoryData = windowPredictions.map((wp) => {
    const val = Number((wp.features[activeFeatureKey] ?? 0).toFixed(4));
    const cls = wp.trueLabel ?? wp.prediction;
    return {
      windowNum: wp.windowIndex + 1,
      timeLabel: `${wp.startTime}s–${wp.endTime}s`,
      value: val,
      normalPoint: cls === 0 ? val : null,
      ldosPoint: cls === 1 ? val : null,
      predictedClass: wp.prediction === 1 ? 'LDoS Attack (1)' : 'Normal Traffic (0)',
    };
  });

  const activeFeatureStats = featureSummaryByClass.find((f) => f.feature === activeFeatureKey);
  const decisionMidpoint = activeFeatureStats
    ? Number(((activeFeatureStats.normalMean + activeFeatureStats.ldosMean) / 2).toFixed(4))
    : null;

  // Feature Importance bar data
  const featureImportanceBarData = featureNames.map((fKey) => ({
    name: FEATURE_LABELS[fKey].shortTitle,
    importancePct: Number(((result.featureImportances[fKey] ?? 0) * 100).toFixed(1)),
  }));

  return (
    <div className="space-y-10">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Results Dashboard & Scientific Visualizations
          </h1>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            Job ID: {jobId} · Dataset: {datasetSummary.filename} · Transform: {config.transform} ·
            Features: {featureNames.length} · Model:{' '}
            {config.model === 'decision_tree' ? 'Decision Tree' : 'Random Forest'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onGoToExperiments}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FlaskConical className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            Compare Experiments
          </button>
          <button
            type="button"
            onClick={onOpenReportModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileText className="w-4 h-4" />
            Printable Academic Report
          </button>
        </div>
      </div>

      {/* 5. TOP RESULT CARDS */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Detection Accuracy</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {(metrics.accuracy * 100).toFixed(2)}%
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">Eq. (7) · Test Set</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Precision (Pre)</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {(metrics.precision * 100).toFixed(2)}%
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">Eq. (10) · TP/(TP+FP)</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Recall / Sensitivity</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {(metrics.recall * 100).toFixed(2)}%
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">Eq. (8) · TPR</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">F1 Score</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400 mt-1">
            {(metrics.f1Score * 100).toFixed(2)}%
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">Harmonic Mean</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">False Positive Rate</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {(metrics.fpr * 100).toFixed(2)}%
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">FPR = 1 - TNR</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Windows Analysed</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {metrics.totalWindowsCount}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            {metrics.trainWindowsCount} Train · {metrics.testWindowsCount} Test
          </div>
        </div>
      </section>

      {/* MAIN DETECTION RESULT BANNER */}
      <section
        className={`rounded-xl border p-6 flex flex-wrap items-center justify-between gap-6 ${
          isLdosDetected
            ? 'bg-rose-50/60 dark:bg-rose-950/25 border-rose-300 dark:border-rose-800'
            : 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-800'
        }`}
      >
        <div className="flex items-start gap-4">
          {isLdosDetected ? (
            <ShieldAlert className="w-9 h-9 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-9 h-9 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Primary Classification Verdict
            </div>
            <h2
              className={`text-2xl font-bold font-mono tracking-tight mt-0.5 ${
                isLdosDetected
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {isLdosDetected ? 'LDoS ATTACK DETECTED' : 'NORMAL TRAFFIC'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              {isLdosDetected
                ? `Detected periodic low-frequency attack energy in ${metrics.ldosWindowsCount} of ${metrics.totalWindowsCount} traffic windows.`
                : `All ${metrics.totalWindowsCount} traffic windows exhibit steady normal bottleneck characteristics.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono tabular-nums">
          <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2.5">
            <div className="text-slate-500 font-sans">Normal Windows (0)</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {metrics.normalWindowsCount}
            </div>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2.5">
            <div className="text-slate-500 font-sans">LDoS Windows (1)</div>
            <div className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {metrics.ldosWindowsCount}
            </div>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2.5">
            <div className="text-slate-500 font-sans">% Classified LDoS</div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {metrics.ldosPercentage.toFixed(1)}%
            </div>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2.5">
            <div className="text-slate-500 font-sans">Mean Confidence</div>
            <div className="text-base font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
              {(metrics.meanConfidence * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </section>

      {/* 6A. TIME DOMAIN SIGNAL VISUALIZATION */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              A. Time-Domain Network Traffic Signal Analysis (Wang et al., Fig. 2)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compare steady TCP traffic oscillation under Normal Status (NS = 0) against periodic
              burst preemption and RTO collapse under LDoS Attack Status (LS = 1).
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setTimeSignalViewMode('paper_split')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                timeSignalViewMode === 'paper_split'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Fig. 2: Normal vs. LDoS Zoom
            </button>
            <button
              type="button"
              onClick={() => setTimeSignalViewMode('full_timeline')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                timeSignalViewMode === 'full_timeline'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Full Timeline + Brush Zoom
            </button>
            <button
              type="button"
              onClick={() => setTimeSignalViewMode('dc_removed')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                timeSignalViewMode === 'dc_removed'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              DC-Removed Zero-Mean Signal
            </button>
          </div>
        </div>

        {timeSignalViewMode === 'paper_split' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fig 2(a): Normal Status Waveform */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-950/40 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                    (a) Normal Traffic Status (NS = 0)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    High-frequency stochastic fluctuation around bottleneck capacity (~{datasetSummary.signalStats.mean.toFixed(1)} pkts/0.1s)
                  </p>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded">
                  Class 0
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={normalZoomSlice} margin={{ top: 10, right: 16, left: 0, bottom: 18 }}>
                    <defs>
                      <linearGradient id="normGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.22} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      unit="s"
                      label={{ value: 'Time (Seconds)', position: 'insideBottom', offset: -10, fontSize: 11 }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      domain={[0, 'auto']}
                      label={{ value: 'Traffic Amplitude', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono',
                        borderRadius: '8px',
                      }}
                      formatter={(val) => [`${Number(val ?? 0).toFixed(3)} pkts`, 'Normal Signal']}
                      labelFormatter={(lbl) => `Time: ${lbl}s`}
                    />
                    <ReferenceLine
                      y={datasetSummary.signalStats.mean}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{ value: 'Mean (DC)', position: 'insideTopRight', fontSize: 10, fill: '#10b981' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amplitude"
                      name="Normal Traffic Signal"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#normGrad)"
                      dot={{ r: 2, fill: '#10b981' }}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fig 2(b): LDoS Attack Status Waveform */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-950/40 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 font-mono">
                    (b) LDoS Attack Status (LS = 1)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Periodic square-pulse preemption & TCP throughput drop every attack period T
                  </p>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-mono bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded">
                  Class 1
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ldosZoomSlice} margin={{ top: 10, right: 16, left: 0, bottom: 18 }}>
                    <defs>
                      <linearGradient id="ldosGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.32} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.22} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      unit="s"
                      label={{ value: 'Time (Seconds)', position: 'insideBottom', offset: -10, fontSize: 11 }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      domain={[0, 'auto']}
                      label={{ value: 'Traffic Amplitude', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono',
                        borderRadius: '8px',
                      }}
                      formatter={(val) => [`${Number(val ?? 0).toFixed(3)} pkts`, 'LDoS Signal']}
                      labelFormatter={(lbl) => `Time: ${lbl}s`}
                    />
                    <ReferenceLine
                      y={datasetSummary.signalStats.mean}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{ value: 'Mean (DC)', position: 'insideTopRight', fontSize: 10, fill: '#f43f5e' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amplitude"
                      name="LDoS Traffic Signal"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fill="url(#ldosGrad)"
                      dot={{ r: 2, fill: '#f43f5e' }}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500">
              <span>
                {timeSignalViewMode === 'dc_removed'
                  ? 'Zero-Mean Preprocessed Signal x̃(t) = x(t) - x̄ (Section 4.2.1 DC Component Removal)'
                  : 'Complete Capture Traffic Signal x(t) with Shaded LDoS Attack Windows (Drag bottom brush to zoom)'}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-cyan-600 dark:text-cyan-400">― Signal Waveform</span>
                <span className="text-rose-500">■ Shaded = Detected LDoS Window (Class 1)</span>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={visualizations.timeDomainSignal}
                  margin={{ top: 10, right: 20, left: 5, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.22} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    unit="s"
                  />
                  <YAxis tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(lbl) => `Time: ${lbl}s`}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {ldosIntervals.map((iv, idx) => (
                    <ReferenceArea
                      key={idx}
                      x1={iv.start}
                      x2={iv.end}
                      fill="#f43f5e"
                      fillOpacity={0.14}
                      strokeOpacity={0}
                    />
                  ))}
                  {timeSignalViewMode === 'dc_removed' && (
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                  )}
                  <Line
                    type="monotone"
                    dataKey={timeSignalViewMode === 'dc_removed' ? 'dcRemoved' : 'amplitude'}
                    name={
                      timeSignalViewMode === 'dc_removed'
                        ? 'DC-Removed Signal x̃(t)'
                        : 'Traffic Signal x(t)'
                    }
                    stroke="#06b6d4"
                    strokeWidth={1.75}
                    dot={false}
                  />
                  <Brush
                    dataKey="time"
                    height={26}
                    stroke="#0891b2"
                    fill="#0f172a"
                    tickFormatter={(v) => `${v}s`}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* 6B. TIME-FREQUENCY REPRESENTATION (FSWT / STFT / CWT) + MARGINAL SPECTRUM */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              B. Time–Frequency Representation ({config.transform}{' '}
              {config.transform === 'FSWT'
                ? 'Time–Frequency Distribution'
                : config.transform === 'STFT'
                ? 'Spectrogram'
                : 'Scalogram'}{' '}
              — Wang et al., Fig. 3)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Under Normal Status (NS = 0), spectral energy is dispersed across the mid-high band.
              Under LDoS Attack Status (LS = 1), periodic pulses concentrate dominant energy inside
              the low-frequency band (0 – {visualizations.normalHeatmap.lowFreqCutoffHz} Hz, first 1/5 of observation frequency).
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-500 font-medium">Inspect Window:</label>
            <select
              value={selectedWindowId === null ? '__COMPARE__' : String(selectedWindowId)}
              onChange={(e) =>
                setSelectedWindowId(
                  e.target.value === '__COMPARE__' ? null : Number(e.target.value)
                )
              }
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs cursor-pointer"
            >
              <option value="__COMPARE__">Side-by-Side: Normal (NS) vs. LDoS Attack (LS)</option>
              {availableHeatmapWindows.map((wId) => (
                <option key={wId} value={wId}>
                  Window #{wId + 1} (
                  {visualizations.sampleWindowHeatmaps[wId].label === 1 ? 'LDoS' : 'Normal'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {inspectedHeatmap ? (
          <TimeFrequencyCanvas
            heatmap={inspectedHeatmap}
            subtitle={`High-Resolution 2D ${config.transform} Time–Frequency Distribution Matrix |M_ij|`}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimeFrequencyCanvas
              heatmap={visualizations.normalHeatmap}
              subtitle="Fig. 3(a) Normal Status (NS = 0): Dispersed mid-high frequency energy, high Entropy"
            />
            <TimeFrequencyCanvas
              heatmap={visualizations.ldosHeatmap}
              subtitle="Fig. 3(b) LDoS Status (LS = 1): Intense low-frequency (0–1 Hz) energy stripe, high Energy Ratio"
            />
          </div>
        )}

        {/* Marginal Frequency Energy Spectrum Comparison */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-950/40 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 font-mono">
                Marginal Frequency Energy Distribution: Normal (NS) vs. LDoS Attack (LS)
              </h4>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Shaded Cyan Band = First 1/5 Low-Frequency Region (0 – {visualizations.normalHeatmap.lowFreqCutoffHz} Hz)
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={marginalSpectrumData} margin={{ top: 10, right: 20, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.22} />
                <XAxis
                  dataKey="freqHz"
                  tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  unit="Hz"
                  label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -10, fontSize: 11 }}
                />
                <YAxis
                  tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  label={{ value: 'Mean Energy |M(f)|²', angle: -90, position: 'insideLeft', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(lbl) => `Frequency: ${lbl} Hz`}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                <ReferenceArea
                  x1={0}
                  x2={visualizations.normalHeatmap.lowFreqCutoffHz}
                  fill="#06b6d4"
                  fillOpacity={0.14}
                />
                <ReferenceLine
                  x={visualizations.normalHeatmap.lowFreqCutoffHz}
                  stroke="#06b6d4"
                  strokeDasharray="4 4"
                  label={{
                    value: `1/5 fs (${visualizations.normalHeatmap.lowFreqCutoffHz} Hz)`,
                    position: 'insideTopRight',
                    fontSize: 10,
                    fill: '#06b6d4',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="normalEnergy"
                  name="Normal Traffic Energy (NS = 0)"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="ldosEnergy"
                  name="LDoS Attack Energy (LS = 1)"
                  stroke="#f43f5e"
                  fill="#f43f5e"
                  fillOpacity={0.25}
                  strokeWidth={2.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 6C. FEATURE VISUALIZATION (Wang et al., Figs. 4–7) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              C. Extracted Time–Frequency Feature Curves ({featureNames.length} Selected Features — Wang et al., Figs. 4–7)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Direct comparison of Normal Status (NS = 0, emerald) vs. LDoS Attack Status (LS = 1,
              rose) across signal windows, with class means and decision thresholds.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setFeatureViewMode('grid_all')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  featureViewMode === 'grid_all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                All Features Grid (Figs. 4–7)
              </button>
              <button
                type="button"
                onClick={() => setFeatureViewMode('single_detail')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  featureViewMode === 'single_detail'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Single Feature Inspector
              </button>
            </div>
          </div>
        </div>

        {featureViewMode === 'grid_all' ? (
          /* 2x2 or 2x3 Small-Multiples Publication Grid matching Figs. 4, 5, 6, 7 of Wang et al. (2024) */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {featureNames.map((fKey) => {
              const meta = FEATURE_LABELS[fKey];
              const stat = featureSummaryByClass.find((s) => s.feature === fKey);
              const series = pairedFeatureComparisonByKey[fKey] || [];
              const thresholdVal = stat
                ? Number(((stat.normalMean + stat.ldosMean) / 2).toFixed(4))
                : null;

              return (
                <div
                  key={fKey}
                  className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-950/40 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {meta.title}
                        </h4>
                        <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 rounded">
                          {meta.paperFig}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">{meta.formula}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFeatureTab(fKey);
                        setFeatureViewMode('single_detail');
                      }}
                      className="text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer shrink-0"
                    >
                      Expand →
                    </button>
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 14 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.22} />
                        <XAxis
                          dataKey="index"
                          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          label={{ value: 'Window Sample Index', position: 'insideBottom', offset: -8, fontSize: 10 }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            color: '#f8fafc',
                            fontSize: '12px',
                            fontFamily: 'JetBrains Mono',
                            borderRadius: '8px',
                          }}
                          labelFormatter={(lbl) => `Class Window #${lbl}`}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                        {thresholdVal !== null && (
                          <ReferenceLine
                            y={thresholdVal}
                            stroke="#f59e0b"
                            strokeDasharray="5 4"
                            label={{
                              value: `Split ≈ ${thresholdVal}`,
                              position: 'insideTopRight',
                              fontSize: 10,
                              fill: '#f59e0b',
                            }}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="normalVal"
                          name="Normal Status (NS = 0)"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#10b981' }}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="ldosVal"
                          name="LDoS Attack Status (LS = 1)"
                          stroke="#f43f5e"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#f43f5e' }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {stat && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono tabular-nums">
                      <span className="text-emerald-700 dark:text-emerald-400">
                        NS Mean: {stat.normalMean.toFixed(3)} ± {stat.normalStd.toFixed(3)}
                      </span>
                      <span className="text-rose-700 dark:text-rose-400">
                        LS Mean: {stat.ldosMean.toFixed(3)} ± {stat.ldosStd.toFixed(3)}
                      </span>
                      <span className="text-cyan-600 dark:text-cyan-400">
                        Gini Imp: {((result.featureImportances[fKey] ?? 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Single Feature Detailed View + Gini Importance Chart */
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
              {featureNames.map((fKey) => (
                <button
                  key={fKey}
                  type="button"
                  onClick={() => setSelectedFeatureTab(fKey)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeFeatureKey === fKey
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {FEATURE_LABELS[fKey].shortTitle}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-950/40 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {FEATURE_LABELS[activeFeatureKey].title} Across All {windowPredictions.length} Windows
                    </h4>
                    <p className="text-xs text-slate-500">
                      {FEATURE_LABELS[activeFeatureKey].interpretation}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                    {FEATURE_LABELS[activeFeatureKey].formula}
                  </span>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={featureTrajectoryData}
                      margin={{ top: 10, right: 20, left: 0, bottom: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.22} />
                      <XAxis
                        dataKey="windowNum"
                        tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                        label={{ value: 'Chronological Window #', position: 'insideBottom', offset: -10, fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          color: '#f8fafc',
                          fontSize: '12px',
                          fontFamily: 'JetBrains Mono',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                      {decisionMidpoint !== null && (
                        <ReferenceLine
                          y={decisionMidpoint}
                          stroke="#f59e0b"
                          strokeDasharray="5 4"
                          label={{
                            value: `Decision Threshold ≈ ${decisionMidpoint}`,
                            position: 'insideTopRight',
                            fontSize: 11,
                            fill: '#f59e0b',
                          }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="value"
                        name="Feature Trajectory"
                        stroke="#64748b"
                        strokeWidth={1.25}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="normalPoint"
                        name="Normal Window (NS = 0)"
                        stroke="#10b981"
                        strokeWidth={2.2}
                        dot={{ r: 3.5, fill: '#10b981' }}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="ldosPoint"
                        name="LDoS Window (LS = 1)"
                        stroke="#f43f5e"
                        strokeWidth={2.2}
                        dot={{ r: 3.5, fill: '#f43f5e' }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right 4 Cols: Gini Importance Bar Chart & Class Summary */}
              <div className="lg:col-span-4 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-950/40 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Classifier Gini Feature Importance (%)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Relative contribution of each feature in the trained{' '}
                    {config.model === 'decision_tree' ? 'CART Decision Tree' : 'Random Forest'}
                  </p>
                </div>

                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={featureImportanceBarData}
                      layout="vertical"
                      margin={{ top: 5, right: 38, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.2} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                        unit="%"
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          color: '#f8fafc',
                          fontSize: '12px',
                          fontFamily: 'JetBrains Mono',
                        }}
                        formatter={(val) => [`${val ?? 0}%`, 'Gini Importance']}
                      />
                      <Bar dataKey="importancePct" fill="#06b6d4" radius={[0, 4, 4, 0]}>
                        <LabelList
                          dataKey="importancePct"
                          position="right"
                          formatter={(v) => `${v ?? 0}%`}
                          style={{ fontSize: '10px', fontFamily: 'JetBrains Mono', fill: '#94a3b8' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 6D. CONFUSION MATRIX HEATMAP & 6E. CLASSIFICATION RESULTS TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* D. Scientific 2x2 Confusion Matrix Heatmap (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              D. Confusion Matrix Heatmap (Wang et al., Table 1)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Evaluated on held-out test set ({metrics.testWindowsCount} windows)
            </p>
          </div>

          {/* 2x2 Annotated Matrix Grid */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden font-mono text-xs tabular-nums">
            <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-semibold text-center">
              <div className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-slate-500">
                Actual \ Predicted
              </div>
              <div className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400">
                Pred: Normal (0)
              </div>
              <div className="p-2.5 text-rose-700 dark:text-rose-400">Pred: LDoS (1)</div>
            </div>

            {/* Row 1: Actual Normal (NS=0) */}
            <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800">
              <div className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col justify-center font-semibold">
                <span className="text-emerald-700 dark:text-emerald-400">Actual: Normal</span>
                <span className="text-[10px] text-slate-400">Class NS = 0</span>
              </div>
              <div className="p-4 border-r border-slate-200 dark:border-slate-800 bg-emerald-500/15 dark:bg-emerald-500/20 text-center">
                <div className="text-[11px] font-sans font-semibold text-emerald-800 dark:text-emerald-300">
                  True Negative (TN)
                </div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {metrics.confusionMatrix.tn}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  TNR: {(metrics.specificity * 100).toFixed(1)}%
                </div>
              </div>
              <div className="p-4 bg-amber-500/10 dark:bg-amber-500/15 text-center">
                <div className="text-[11px] font-sans font-semibold text-amber-800 dark:text-amber-300">
                  False Positive (FP)
                </div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                  {metrics.confusionMatrix.fp}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  FPR: {(metrics.fpr * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Row 2: Actual LDoS (LS=1) */}
            <div className="grid grid-cols-3">
              <div className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col justify-center font-semibold">
                <span className="text-rose-700 dark:text-rose-400">Actual: LDoS</span>
                <span className="text-[10px] text-slate-400">Class LS = 1</span>
              </div>
              <div className="p-4 border-r border-slate-200 dark:border-slate-800 bg-amber-500/10 dark:bg-amber-500/15 text-center">
                <div className="text-[11px] font-sans font-semibold text-amber-800 dark:text-amber-300">
                  False Negative (FN)
                </div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                  {metrics.confusionMatrix.fn}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  FNR: {(metrics.fnr * 100).toFixed(1)}%
                </div>
              </div>
              <div className="p-4 bg-cyan-500/15 dark:bg-cyan-500/20 text-center">
                <div className="text-[11px] font-sans font-semibold text-cyan-800 dark:text-cyan-300">
                  True Positive (TP)
                </div>
                <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300 mt-0.5">
                  {metrics.confusionMatrix.tp}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  TPR: {(metrics.recall * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums">
            <div className="flex justify-between">
              <span>Sensitivity / Detection Rate (TPR, Eq. 8):</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {(metrics.recall * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Specificity / True Negative Rate (TNR, Eq. 9):</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {(metrics.specificity * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>False Positive Rate (FPR = 1 - TNR):</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {(metrics.fpr * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* E. Classification Results Table (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                E. Window-Level Classification Results
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Showing {filteredPredictions.length} of {windowPredictions.length} signal windows
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Window # or time..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'ldos', label: 'LDoS (1)' },
                    { id: 'normal', label: 'Normal (0)' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setWindowFilter(f.id)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      windowFilter === f.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-y-auto max-h-80 border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-xs font-mono tabular-nums text-left border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                <tr>
                  <th className="py-2 px-3 border-b border-slate-200 dark:border-slate-700">Window #</th>
                  <th className="py-2 px-3 border-b border-slate-200 dark:border-slate-700">Time (s)</th>
                  <th className="py-2 px-3 border-b border-slate-200 dark:border-slate-700">Prediction</th>
                  <th className="py-2 px-3 border-b border-slate-200 dark:border-slate-700">True Label</th>
                  <th className="py-2 px-3 border-b border-slate-200 dark:border-slate-700">Confidence</th>
                  <th className="py-2 px-3 border-b border-slate-200 dark:border-slate-700">Split</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredPredictions.map((wp) => (
                  <tr key={wp.windowIndex} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-semibold">#{wp.windowIndex + 1}</td>
                    <td className="py-2 px-3 text-slate-500">
                      {wp.startTime.toFixed(1)}–{wp.endTime.toFixed(1)}s
                    </td>
                    <td
                      className={`py-2 px-3 font-semibold ${
                        wp.prediction === 1
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {wp.prediction === 1 ? '1 · LDoS Attack' : '0 · Normal Traffic'}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                      {wp.trueLabel !== null
                        ? wp.trueLabel === 1
                          ? '1 (LDoS)'
                          : '0 (Normal)'
                        : 'N/A'}
                    </td>
                    <td className="py-2 px-3">{(wp.confidence * 100).toFixed(1)}%</td>
                    <td className="py-2 px-3 text-slate-500">
                      {wp.isTestWindow ? 'Test' : 'Train'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 8. DOWNLOAD SECTION */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Download Research Artifacts & Reports
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Export window predictions, extracted time-frequency features, evaluation metrics CSVs,
            and the printable academic report for your Signals & Systems presentation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <a
            href={getDownloadUrl(jobId, 'predictions.csv')}
            download
            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-cyan-500 dark:hover:border-cyan-400 bg-slate-50/50 dark:bg-slate-950/40 transition-colors"
          >
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Prediction Results CSV
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                {windowPredictions.length} windows · Labels & Confidence
              </div>
            </div>
            <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          </a>

          <a
            href={getDownloadUrl(jobId, 'features.csv')}
            download
            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-cyan-500 dark:hover:border-cyan-400 bg-slate-50/50 dark:bg-slate-950/40 transition-colors"
          >
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Feature Dataset CSV
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                {config.transform} · {featureNames.length} extracted features
              </div>
            </div>
            <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          </a>

          <a
            href={getDownloadUrl(jobId, 'metrics.csv')}
            download
            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-cyan-500 dark:hover:border-cyan-400 bg-slate-50/50 dark:bg-slate-950/40 transition-colors"
          >
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Evaluation Metrics CSV
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                Accuracy, Precision, Recall, F1, FPR, CM
              </div>
            </div>
            <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          </a>

          <button
            type="button"
            onClick={onOpenReportModal}
            className="flex items-center justify-between p-4 rounded-lg border border-cyan-500/50 bg-cyan-50/30 dark:bg-cyan-950/20 hover:bg-cyan-50/60 dark:hover:bg-cyan-950/40 transition-colors text-left cursor-pointer"
          >
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Final Academic Report
              </div>
              <div className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 mt-0.5">
                Printable PDF / HTML Summary
              </div>
            </div>
            <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          </button>
        </div>
      </section>
    </div>
  );
};
