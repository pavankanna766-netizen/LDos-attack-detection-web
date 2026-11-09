export type UploadMode = 'single' | 'dual';
export type TransformType = 'FSWT' | 'STFT' | 'CWT';
export type FeatureSetType = 'original_4' | 'extended_6';
export type ModelType = 'decision_tree' | 'random_forest';
export type SplitStrategyType = 'stratified' | 'temporal';

export interface DatasetSummary {
  datasetId: string;
  filename: string;
  mode: UploadMode;
  numRows: number;
  numColumns: number;
  columns: string[];
  numericColumns: string[];
  selectedSignalColumn: string;
  selectedLabelColumn: string | null;
  missingValues: number;
  hasLabels: boolean;
  classDistribution: {
    normal: number;
    ldos: number;
    unlabelled: number;
  };
  signalStats: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  previewRows: Record<string, string | number>[];
}

export interface DetectionConfig {
  datasetId: string;
  signalColumn: string;
  labelColumn: string | null;
  samplingRate: number;
  windowSize: number;
  windowStride: number;
  transform: TransformType;
  featureSet: FeatureSetType;
  model: ModelType;
  splitStrategy: SplitStrategyType;
  testSize: number;
  randomState: number;
  fswtParams: {
    lambda: number;
    eta: number;
    upsilon: number;
    kappa: number;
  };
}

export interface FeatureValues {
  entropy: number;
  energy_ratio: number;
  contrast: number;
  correlation: number;
  spectral_centroid?: number;
  kurtosis?: number;
}

export interface WindowPrediction {
  windowIndex: number;
  startSample: number;
  endSample: number;
  startTime: number;
  endTime: number;
  prediction: 0 | 1;
  trueLabel: 0 | 1 | null;
  confidence: number;
  isTestWindow: boolean;
  features: FeatureValues;
}

export interface ConfusionMatrixData {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

export interface EvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number; // Sensitivity / TPR
  specificity: number; // TNR
  f1Score: number;
  fpr: number; // 1 - TNR
  fnr: number; // 1 - TPR
  confusionMatrix: ConfusionMatrixData;
  trainWindowsCount: number;
  testWindowsCount: number;
  totalWindowsCount: number;
  normalWindowsCount: number;
  ldosWindowsCount: number;
  ldosPercentage: number;
  meanConfidence: number;
  overallVerdict: 'LDOS_DETECTED' | 'NORMAL_TRAFFIC';
}

export interface TimeFrequencyHeatmap {
  windowIndex: number;
  label: 0 | 1;
  title: string;
  times: number[];
  frequencies: number[];
  matrix: number[][]; // shape: [timeBins][freqBins]
  lowFreqCutoffHz: number;
}

export interface PipelineStepLog {
  step: number;
  name: string;
  detail: string;
  durationMs: number;
  status: 'completed' | 'running' | 'pending' | 'error';
}

export interface DetectionJobResult {
  jobId: string;
  timestamp: string;
  datasetSummary: DatasetSummary;
  config: DetectionConfig;
  steps: PipelineStepLog[];
  metrics: EvaluationMetrics;
  featureNames: (keyof FeatureValues)[];
  featureImportances: Record<string, number>;
  featureSummaryByClass: {
    feature: string;
    normalMean: number;
    normalStd: number;
    ldosMean: number;
    ldosStd: number;
  }[];
  windowPredictions: WindowPrediction[];
  visualizations: {
    timeDomainSignal: {
      time: number;
      amplitude: number;
      dcRemoved: number;
      trueLabel: 0 | 1 | null;
      predictedLabel: 0 | 1;
      windowIndex: number;
    }[];
    normalHeatmap: TimeFrequencyHeatmap;
    ldosHeatmap: TimeFrequencyHeatmap;
    sampleWindowHeatmaps: Record<number, TimeFrequencyHeatmap>;
  };
}

export interface ExperimentComparisonItem {
  experimentId: string;
  experimentName: string;
  isPaperBaseline?: boolean;
  jobId: string;
  datasetFilename: string;
  transform: TransformType;
  featureSet: FeatureSetType;
  featureCount: number;
  model: ModelType;
  splitStrategy: SplitStrategyType;
  accuracy: number;
  precision: number;
  recall: number;
  specificity: number;
  f1Score: number;
  fpr: number;
  confusionMatrix: ConfusionMatrixData;
  executedAt: string;
}

export interface BenchmarkPreset {
  id: string;
  name: string;
  environment: 'NS2 Simulation' | 'Physical Testbed' | 'SDN / Slowloris';
  description: string;
  attackParams: {
    T: number; // Period (s)
    L: number; // Duration (s)
    R: number; // Rate (Mbps)
    attackWindowSec: string;
  };
  samplingRate: number;
  windowSize: number;
  totalSamples: number;
}
