import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import {
  BenchmarkPreset,
  DatasetSummary,
  DetectionConfig,
  DetectionJobResult,
  ExperimentComparisonItem,
  FeatureSetType,
  ModelType,
  PipelineStepLog,
  TransformType,
  UploadMode,
} from './types/ldos';
import {
  fetchBenchmarkPresets,
  loadBenchmarkPreset,
  runDetectionApi,
  uploadDatasetApi,
  validateDatasetApi,
} from './services/api';
import {
  saveExperimentToFirestore,
  deleteExperimentFromFirestore,
  subscribeToSessionExperiments,
} from './services/firebase';
import { HomePage } from './pages/HomePage';
import { DatasetUploadPage } from './pages/DatasetUploadPage';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { ResultsDashboardPage } from './pages/ResultsDashboardPage';
import { ExperimentComparisonPage } from './pages/ExperimentComparisonPage';
import { AcademicReportModal } from './components/AcademicReportModal';

type ActivePage = 'home' | 'upload' | 'configure' | 'results' | 'experiments';

const DEFAULT_CONFIG: DetectionConfig = {
  datasetId: '',
  signalColumn: 'traffic_packets',
  labelColumn: 'label',
  samplingRate: 10,
  windowSize: 100,
  windowStride: 100,
  transform: 'FSWT',
  featureSet: 'original_4',
  model: 'decision_tree',
  splitStrategy: 'stratified',
  testSize: 0.3,
  randomState: 42,
  fswtParams: {
    lambda: 1.0,
    eta: 0.05,
    upsilon: 0.5,
    kappa: 23.5482,
  },
};

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [isDark, setIsDark] = useState<boolean>(true);

  const [benchmarks, setBenchmarks] = useState<BenchmarkPreset[]>([]);
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [config, setConfig] = useState<DetectionConfig>(DEFAULT_CONFIG);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<PipelineStepLog[]>([]);
  const [runError, setRunError] = useState<string | null>(null);

  const [latestResult, setLatestResult] = useState<DetectionJobResult | null>(null);
  const [localExperiments, setLocalExperiments] = useState<ExperimentComparisonItem[]>([]);
  const [cloudExperiments, setCloudExperiments] = useState<ExperimentComparisonItem[]>([]);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [runningExperimentName, setRunningExperimentName] = useState<string | null>(null);

  const [showReportModal, setShowReportModal] = useState(false);

  // Sync dark mode class on <html>
  useEffect(() => {
    const rootEl = document.documentElement;
    if (isDark) {
      rootEl.classList.add('dark');
    } else {
      rootEl.classList.remove('dark');
    }
  }, [isDark]);

  // Subscribe to login-free Firestore session experiments
  useEffect(() => {
    const unsubFirestore = subscribeToSessionExperiments((items) => {
      setCloudExperiments(items);
    });
    return () => unsubFirestore();
  }, []);

  // Fetch available benchmark presets and preload NS2 Set 1 benchmark on initial mount so the user can test immediately
  useEffect(() => {
    fetchBenchmarkPresets()
      .then((list) => {
        setBenchmarks(list);
        if (list.length > 0) {
          loadBenchmarkPreset(list[0].id)
            .then((data) => {
              setSummary(data.summary);
              setConfig((prev) => ({
                ...prev,
                datasetId: data.datasetId,
                signalColumn: data.summary.selectedSignalColumn,
                labelColumn: data.summary.selectedLabelColumn,
                samplingRate: data.preset.samplingRate,
                windowSize: data.preset.windowSize,
                windowStride: data.preset.windowSize,
              }));
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const displayedExperiments =
    cloudExperiments.length > 0 ? cloudExperiments : localExperiments;

  const handleUpdateConfig = (partial: Partial<DetectionConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const handleSelectBenchmark = async (presetId: string, navigateToConfig = false) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const data = await loadBenchmarkPreset(presetId);
      setSummary(data.summary);
      setConfig((prev) => ({
        ...prev,
        datasetId: data.datasetId,
        signalColumn: data.summary.selectedSignalColumn,
        labelColumn: data.summary.selectedLabelColumn,
        samplingRate: data.preset.samplingRate,
        windowSize: data.preset.windowSize,
        windowStride: data.preset.windowSize,
      }));
      if (navigateToConfig) {
        setActivePage('configure');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to load benchmark dataset.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadDataset = async (payload: {
    mode: UploadMode;
    filename?: string;
    csvContent?: string;
    normalFilename?: string;
    normalCsvContent?: string;
    ldosFilename?: string;
    ldosCsvContent?: string;
  }) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const data = await uploadDatasetApi(payload);
      setSummary(data.summary);
      setConfig((prev) => ({
        ...prev,
        datasetId: data.datasetId,
        signalColumn: data.summary.selectedSignalColumn,
        labelColumn: data.summary.selectedLabelColumn,
      }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'CSV upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRevalidateColumns = async (signalColumn: string, labelColumn: string | null) => {
    if (!summary) return;
    try {
      const data = await validateDatasetApi({
        datasetId: summary.datasetId,
        signalColumn,
        labelColumn,
      });
      setSummary(data.summary);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Column validation failed.');
    }
  };

  const handleApplyPaperBaseline = () => {
    setConfig((prev) => ({
      ...prev,
      transform: 'FSWT',
      featureSet: 'original_4',
      model: 'decision_tree',
      samplingRate: 10,
      windowSize: 100,
      windowStride: 100,
      testSize: 0.3,
      randomState: 42,
    }));
  };

  const recordExperimentRun = async (
    res: DetectionJobResult,
    customLabel?: string,
    isBaseline?: boolean
  ) => {
    const featCount = res.config.featureSet === 'original_4' ? 4 : 6;
    const defaultLabel =
      res.config.transform === 'FSWT' &&
      res.config.featureSet === 'original_4' &&
      res.config.model === 'decision_tree'
        ? 'Experiment 1 ★ (Paper Baseline)'
        : `${res.config.transform} + ${featCount} Features + ${
            res.config.model === 'decision_tree' ? 'Decision Tree' : 'Random Forest'
          }`;

    const expLabel = customLabel || defaultLabel;

    const item: ExperimentComparisonItem = {
      experimentId: res.jobId,
      experimentName: expLabel,
      isPaperBaseline: isBaseline,
      jobId: res.jobId,
      datasetFilename: res.datasetSummary.filename,
      transform: res.config.transform,
      featureSet: res.config.featureSet,
      featureCount: featCount,
      model: res.config.model,
      splitStrategy: res.config.splitStrategy,
      accuracy: res.metrics.accuracy,
      precision: res.metrics.precision,
      recall: res.metrics.recall,
      specificity: res.metrics.specificity,
      f1Score: res.metrics.f1Score,
      fpr: res.metrics.fpr,
      confusionMatrix: res.metrics.confusionMatrix,
      executedAt: res.timestamp,
    };

    setLocalExperiments((prev) => {
      const filtered = prev.filter(
        (e) =>
          !(
            e.datasetFilename === item.datasetFilename &&
            e.transform === item.transform &&
            e.featureSet === item.featureSet &&
            e.model === item.model
          )
      );
      return [...filtered, item];
    });

    try {
      await saveExperimentToFirestore(res, expLabel);
    } catch {
      // Fallback to local state if Firestore write fails
    }
  };

  const handleRunDetection = async () => {
    if (!summary) return;
    setIsRunning(true);
    setRunError(null);
    setCompletedSteps([]);
    setActiveStepIndex(0);

    const timer = setInterval(() => {
      setActiveStepIndex((prev) => Math.min(7, prev + 1));
    }, 80);

    try {
      const result = await runDetectionApi({
        ...config,
        datasetId: summary.datasetId,
      });
      clearInterval(timer);
      setCompletedSteps(result.steps);
      setLatestResult(result);
      await recordExperimentRun(result);
      setActivePage('results');
    } catch (err) {
      clearInterval(timer);
      setRunError(err instanceof Error ? err.message : 'Detection pipeline failed.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunSpecificExperiment = async (spec: {
    experimentName: string;
    transform: TransformType;
    featureSet: FeatureSetType;
    model: ModelType;
    isPaperBaseline?: boolean;
  }) => {
    if (!summary) return;
    setIsRunningBatch(true);
    setRunningExperimentName(spec.experimentName);
    try {
      const expConfig: DetectionConfig = {
        ...config,
        datasetId: summary.datasetId,
        transform: spec.transform,
        featureSet: spec.featureSet,
        model: spec.model,
      };
      const result = await runDetectionApi(expConfig);
      setLatestResult(result);
      await recordExperimentRun(result, spec.experimentName, spec.isPaperBaseline);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Experiment execution failed.');
    } finally {
      setIsRunningBatch(false);
      setRunningExperimentName(null);
    }
  };

  const handleRunAllStandardExperiments = async () => {
    if (!summary) return;
    setIsRunningBatch(true);
    try {
      const firstFive: {
        name: string;
        transform: TransformType;
        featureSet: FeatureSetType;
        model: ModelType;
        baseline?: boolean;
        seedOffset: number;
      }[] = [
        {
          name: 'Experiment 1 ★ (FSWT + 4F + DT)',
          transform: 'FSWT',
          featureSet: 'original_4',
          model: 'decision_tree',
          baseline: true,
          seedOffset: 11,
        },
        {
          name: 'Experiment 2 (FSWT + 6F + DT)',
          transform: 'FSWT',
          featureSet: 'extended_6',
          model: 'decision_tree',
          seedOffset: 23,
        },
        {
          name: 'Experiment 3 (STFT + 6F + DT)',
          transform: 'STFT',
          featureSet: 'extended_6',
          model: 'decision_tree',
          seedOffset: 37,
        },
        {
          name: 'Experiment 4 (CWT + 6F + DT)',
          transform: 'CWT',
          featureSet: 'extended_6',
          model: 'decision_tree',
          seedOffset: 53,
        },
        {
          name: 'Experiment 5 (FSWT + 4F + RF)',
          transform: 'FSWT',
          featureSet: 'original_4',
          model: 'random_forest',
          seedOffset: 71,
        },
      ];

      let bestTransformSoFar: TransformType = 'FSWT';
      let bestF1SoFar = -1;

      for (const spec of firstFive) {
        setRunningExperimentName(spec.name);
        const res = await runDetectionApi({
          ...config,
          datasetId: summary.datasetId,
          transform: spec.transform,
          featureSet: spec.featureSet,
          model: spec.model,
          randomState: config.randomState + spec.seedOffset,
        });
        await recordExperimentRun(res, spec.name, spec.baseline);
        if (spec.model === 'decision_tree' && res.metrics.f1Score > bestF1SoFar) {
          bestF1SoFar = res.metrics.f1Score;
          bestTransformSoFar = spec.transform;
        }
      }

      const exp6Name = `Experiment 6 (${bestTransformSoFar} + 6F + RF)`;
      setRunningExperimentName(exp6Name);
      const res6 = await runDetectionApi({
        ...config,
        datasetId: summary.datasetId,
        transform: bestTransformSoFar,
        featureSet: 'extended_6',
        model: 'random_forest',
        randomState: config.randomState + 97,
      });
      setLatestResult(res6);
      await recordExperimentRun(res6, exp6Name, false);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Batch experiment execution failed.');
    } finally {
      setIsRunningBatch(false);
      setRunningExperimentName(null);
    }
  };

  const handleDeleteExperiment = async (experimentId: string) => {
    setLocalExperiments((prev) => prev.filter((e) => e.experimentId !== experimentId));
    try {
      await deleteExperimentFromFirestore(experimentId);
    } catch {
      // ignore if local only
    }
  };

  const handleClearExperiments = async () => {
    setLocalExperiments([]);
    for (const exp of cloudExperiments) {
      try {
        await deleteExperimentFromFirestore(exp.experimentId);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-3.5 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 no-print">
        {/* Zone 1: Brand Title (Single text element wordmark) */}
        <button
          type="button"
          onClick={() => setActivePage('home')}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          LDoS Attack Detector
        </button>

        {/* Zone 2: 5 Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          {(
            [
              { id: 'home', label: 'Home' },
              { id: 'upload', label: 'Dataset' },
              { id: 'configure', label: 'Configuration' },
              { id: 'results', label: 'Results' },
              { id: 'experiments', label: 'Experiments' },
            ] as const
          ).map((navItem) => (
            <button
              key={navItem.id}
              type="button"
              onClick={() => setActivePage(navItem.id)}
              className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                activePage === navItem.id
                  ? 'text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-400 font-semibold'
                  : ''
              }`}
            >
              {navItem.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setActivePage(summary ? 'configure' : 'upload')}
            className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {summary ? 'Configure & Run' : 'Start Detection'}
          </button>
        </div>
      </header>

      {/* Secondary Workspace Context & Theme Bar (No Login Required) */}
      <div className="bg-slate-100/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800/80 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
        <div className="flex items-center gap-2 font-mono text-slate-600 dark:text-slate-400 overflow-x-auto">
          <span>Active Dataset:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-200">
            {summary ? `${summary.filename} (${summary.numRows.toLocaleString()} rows)` : 'Loading...'}
          </span>
          <span>·</span>
          <span>Transform: {config.transform}</span>
          <span>·</span>
          <span>
            Model: {config.model === 'decision_tree' ? 'Decision Tree' : 'Random Forest'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Mobile Navigation Links */}
          <div className="flex md:hidden items-center gap-1.5">
            {(
              [
                { id: 'home', label: 'Home' },
                { id: 'upload', label: 'Dataset' },
                { id: 'configure', label: 'Config' },
                { id: 'results', label: 'Results' },
                { id: 'experiments', label: 'Exps' },
              ] as const
            ).map((mNav) => (
              <button
                key={mNav.id}
                type="button"
                onClick={() => setActivePage(mNav.id)}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  activePage === mNav.id
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {mNav.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {activePage === 'home' && (
          <HomePage
            onStartDetection={() => setActivePage('upload')}
            onQuickLoadBenchmark={(presetId) => handleSelectBenchmark(presetId, true)}
            isLoadingBenchmark={isUploading}
          />
        )}

        {activePage === 'upload' && (
          <DatasetUploadPage
            benchmarks={benchmarks}
            summary={summary}
            config={config}
            onUpdateConfig={handleUpdateConfig}
            onUploadDataset={handleUploadDataset}
            onSelectBenchmark={(presetId) => handleSelectBenchmark(presetId, false)}
            onRevalidateColumns={handleRevalidateColumns}
            onProceedToConfig={() => setActivePage('configure')}
            isUploading={isUploading}
            uploadError={uploadError}
          />
        )}

        {activePage === 'configure' && (
          <ConfigurationPage
            summary={summary}
            config={config}
            onUpdateConfig={handleUpdateConfig}
            onApplyPaperBaseline={handleApplyPaperBaseline}
            onRunDetection={handleRunDetection}
            isRunning={isRunning}
            activeStepIndex={activeStepIndex}
            completedSteps={completedSteps}
            runError={runError}
            onGoToUpload={() => setActivePage('upload')}
          />
        )}

        {activePage === 'results' && (
          <ResultsDashboardPage
            result={latestResult}
            onOpenReportModal={() => setShowReportModal(true)}
            onGoToExperiments={() => setActivePage('experiments')}
            onGoToConfigure={() => setActivePage('configure')}
          />
        )}

        {activePage === 'experiments' && (
          <ExperimentComparisonPage
            summary={summary}
            experiments={displayedExperiments}
            onRunSpecificExperiment={handleRunSpecificExperiment}
            onRunAllStandardExperiments={handleRunAllStandardExperiments}
            onDeleteExperiment={handleDeleteExperiment}
            onClearExperiments={handleClearExperiments}
            isRunningBatch={isRunningBatch}
            runningExperimentName={runningExperimentName}
            onGoToUpload={() => setActivePage('upload')}
          />
        )}
      </main>

      {/* Quiet Academic Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-5 px-6 text-xs text-slate-500 dark:text-slate-400 no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            LDoS Attack Detector · Signals & Systems Academic Research Project · Based on Wang et
            al. (2024) FSWT Time–Frequency Distribution Methodology
          </div>
          <div className="font-mono">
            Normal Traffic = 0 · LDoS Attack = 1 · Default fs = 10 Hz, N = 100 samples
          </div>
        </div>
      </footer>

      {/* Printable Academic Summary Report Modal */}
      <AcademicReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        result={latestResult}
        experiments={displayedExperiments}
      />
    </div>
  );
}
