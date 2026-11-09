import React from 'react';
import {
  Star,
  Play,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Sliders,
  Waves,
  GitBranch,
  Layers,
} from 'lucide-react';
import {
  DatasetSummary,
  DetectionConfig,
  FeatureSetType,
  ModelType,
  PipelineStepLog,
  SplitStrategyType,
  TransformType,
} from '../types/ldos';

interface ConfigurationPageProps {
  summary: DatasetSummary | null;
  config: DetectionConfig;
  onUpdateConfig: (partial: Partial<DetectionConfig>) => void;
  onApplyPaperBaseline: () => void;
  onRunDetection: () => Promise<void>;
  isRunning: boolean;
  activeStepIndex: number;
  completedSteps: PipelineStepLog[];
  runError: string | null;
  onGoToUpload: () => void;
}

const PIPELINE_STAGE_NAMES = [
  'Dataset Uploaded',
  'Dataset Validated',
  'Preprocessing Traffic Signal',
  'Segmenting Windows',
  'Applying Transform',
  'Extracting Features',
  'Training Model',
  'Evaluating Results',
];

export const ConfigurationPage: React.FC<ConfigurationPageProps> = ({
  summary,
  config,
  onUpdateConfig,
  onApplyPaperBaseline,
  onRunDetection,
  isRunning,
  activeStepIndex,
  completedSteps,
  runError,
  onGoToUpload,
}) => {
  const isBaselineActive =
    config.transform === 'FSWT' &&
    config.featureSet === 'original_4' &&
    config.model === 'decision_tree';

  if (!summary) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          No Dataset Loaded
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Please upload a network traffic CSV dataset or select a paper benchmark dataset before
          configuring the signal processing and machine learning pipeline.
        </p>
        <button
          type="button"
          onClick={onGoToUpload}
          className="px-4 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors cursor-pointer"
        >
          Go to Dataset Upload
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Research Paper Baseline Preset */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            2. Detection Pipeline Configuration
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Active Dataset:{' '}
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {summary.filename}
            </span>{' '}
            · {summary.numRows.toLocaleString()} samples · Signal:{' '}
            <span className="font-mono text-cyan-600 dark:text-cyan-400">
              {config.signalColumn}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onApplyPaperBaseline}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isBaselineActive
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 text-amber-800 dark:text-amber-300'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            ★ Research Paper Baseline (FSWT + 4 Features + Decision Tree)
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={onRunDetection}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing Pipeline...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Run Detection
              </>
            )}
          </button>
        </div>
      </div>

      {/* Recommended Baseline Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold">
            ★ Research Paper Baseline Reference (Wang et al., 2024)
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            FSWT Time–Frequency Distribution + Original 4 Features + Decision Tree Classifier
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Extracts Entropy, Low-Frequency Energy Ratio, Contrast, and Row-Column Correlation from
            the FSWT matrix M_ij to isolate periodic LDoS pulses in the [0, fs/5] low-frequency band.
          </div>
        </div>
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
          Status: {isBaselineActive ? 'Baseline Active' : 'Custom Comparative Mode'}
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Time-Frequency Transform Selection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Signal Transform Method
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">Time-Frequency Domain</span>
          </div>

          <div className="space-y-3">
            {(
              [
                {
                  id: 'FSWT' as TransformType,
                  title: 'FSWT — Frequency Slice Wavelet Transform ★ (Paper Method)',
                  desc: 'Uses Gaussian Frequency Slice Function p̂(ω) = exp(-0.5ω²) with scale parameter κ = 23.5482 for adaptive time-frequency resolution in the low-frequency LDoS band.',
                },
                {
                  id: 'STFT' as TransformType,
                  title: 'STFT — Short-Time Fourier Transform',
                  desc: 'Applies a fixed-length Hamming sliding window and Fourier transform to compute a standard spectrogram.',
                },
                {
                  id: 'CWT' as TransformType,
                  title: 'CWT — Continuous Wavelet Transform',
                  desc: 'Convolves window signals across multi-scale Morlet wavelet basis functions to produce a time-scale scalogram.',
                },
              ] as const
            ).map((item) => {
              const selected = config.transform === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onUpdateConfig({ transform: item.id })}
                  className={`w-full text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                    selected
                      ? 'border-cyan-600 dark:border-cyan-400 bg-cyan-50/40 dark:bg-cyan-950/25'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </span>
                    <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                      {selected ? 'Selected' : 'Select'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {item.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Feature Set Selection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Feature Extraction Set
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">Extracted from M_ij</span>
          </div>

          <div className="space-y-3">
            {(
              [
                {
                  id: 'original_4' as FeatureSetType,
                  title: 'Original 4 Research-Paper Features ★ (Baseline)',
                  features: ['entropy (En)', 'energy_ratio (RE)', 'contrast (Con)', 'correlation (Cor)'],
                  desc: 'Exact 4 characteristics defined in Section 4.2.3 (Eq. 3–6) of Wang et al. (2024) capturing dispersion, low-frequency pulse dominance, stripe contrast, and row-column regularity.',
                },
                {
                  id: 'extended_6' as FeatureSetType,
                  title: 'Extended 6 Features (Comparative Set)',
                  features: [
                    'entropy',
                    'energy_ratio',
                    'contrast',
                    'correlation',
                    'spectral_centroid',
                    'kurtosis',
                  ],
                  desc: 'Appends Spectral Centroid (center of spectral mass in Hz) and time-domain Kurtosis (fourth standardized moment of burstiness) to the 4 baseline features.',
                },
              ] as const
            ).map((fset) => {
              const selected = config.featureSet === fset.id;
              return (
                <button
                  key={fset.id}
                  type="button"
                  onClick={() => onUpdateConfig({ featureSet: fset.id })}
                  className={`w-full text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                    selected
                      ? 'border-cyan-600 dark:border-cyan-400 bg-cyan-50/40 dark:bg-cyan-950/25'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {fset.title}
                    </span>
                    <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                      {selected ? 'Selected' : 'Select'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {fset.desc}
                  </p>
                  <div className="mt-2.5 text-xs font-mono text-slate-700 dark:text-slate-300">
                    {fset.features.join(' · ')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Machine Learning Classifier Selection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Machine Learning Classifier
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">Supervised Classification</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                {
                  id: 'decision_tree' as ModelType,
                  title: 'Decision Tree ★ (Baseline)',
                  desc: 'Fast inference speed, high interpretability, Gini impurity splitting with pruning depth control (Wang et al., Section 4.3.1).',
                },
                {
                  id: 'random_forest' as ModelType,
                  title: 'Random Forest Ensemble',
                  desc: 'Ensemble of bootstrapped CART decision trees with random feature subspaces for variance reduction.',
                },
              ] as const
            ).map((m) => {
              const selected = config.model === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onUpdateConfig({ model: m.id })}
                  className={`text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                    selected
                      ? 'border-cyan-600 dark:border-cyan-400 bg-cyan-50/40 dark:bg-cyan-950/25'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {m.title}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {m.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Validation Split Strategy & Signal Parameters */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Train/Test Split & Signal Settings
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">Default: 30% Test · Seed 42</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                {
                  id: 'stratified' as SplitStrategyType,
                  title: 'Stratified Random Split',
                  desc: 'Preserves exact Normal (0) vs LDoS (1) window ratio across training (70%) and testing (30%) sets.',
                },
                {
                  id: 'temporal' as SplitStrategyType,
                  title: 'Temporal Split',
                  desc: 'Chronological evaluation splitting sequential capture blocks without random shuffling.',
                },
              ] as const
            ).map((sp) => {
              const selected = config.splitStrategy === sp.id;
              return (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => onUpdateConfig({ splitStrategy: sp.id })}
                  className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                    selected
                      ? 'border-cyan-600 dark:border-cyan-400 bg-cyan-50/40 dark:bg-cyan-950/25'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {sp.title}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {sp.desc}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">Sampling Rate</label>
              <input
                type="number"
                value={config.samplingRate}
                onChange={(e) =>
                  onUpdateConfig({ samplingRate: Math.max(1, Number(e.target.value) || 10) })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">Window Size</label>
              <input
                type="number"
                value={config.windowSize}
                onChange={(e) =>
                  onUpdateConfig({ windowSize: Math.max(16, Number(e.target.value) || 100) })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">Test Size (%)</label>
              <input
                type="number"
                min={10}
                max={50}
                value={Math.round(config.testSize * 100)}
                onChange={(e) =>
                  onUpdateConfig({
                    testSize: Math.min(0.5, Math.max(0.1, (Number(e.target.value) || 30) / 100)),
                  })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">Random State</label>
              <input
                type="number"
                value={config.randomState}
                onChange={(e) => onUpdateConfig({ randomState: Number(e.target.value) || 42 })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Page 4: Real-Time Step-by-Step Pipeline Execution Interface */}
      {(isRunning || completedSteps.length > 0 || runError) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Scientific Pipeline Execution Log
            </h3>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {isRunning ? 'Executing Backend Computation...' : 'Execution Complete'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PIPELINE_STAGE_NAMES.map((stageName, idx) => {
              const stepNum = idx + 1;
              const completedLog = completedSteps.find((s) => s.step === stepNum);
              const isDone = Boolean(completedLog) || (!isRunning && completedSteps.length === 8);
              const isCurrent = isRunning && activeStepIndex === idx;

              return (
                <div
                  key={stageName}
                  className={`p-3.5 rounded-lg border text-xs transition-colors ${
                    isDone
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : isCurrent
                      ? 'border-cyan-400 bg-cyan-50/40 dark:bg-cyan-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono mb-1">
                    <span className="text-slate-500">STEP 0{stepNum}</span>
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 text-cyan-600 animate-spin" />
                    ) : (
                      <span className="text-slate-400">⏳</span>
                    )}
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {isDone ? `✓ ${stageName}` : `⏳ ${stageName}`}
                  </div>
                  {completedLog && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                      {completedLog.detail}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {runError && (
            <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{runError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
