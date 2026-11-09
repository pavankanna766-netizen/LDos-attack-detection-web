import {
  BenchmarkPreset,
  DatasetSummary,
  DetectionConfig,
  DetectionJobResult,
  UploadMode,
} from '../types/ldos';

export async function fetchBenchmarkPresets(): Promise<BenchmarkPreset[]> {
  const res = await fetch('/api/benchmarks');
  if (!res.ok) throw new Error('Failed to load benchmark presets.');
  const data = await res.json();
  return data.presets;
}

export async function loadBenchmarkPreset(presetId: string): Promise<{
  datasetId: string;
  preset: BenchmarkPreset;
  summary: DatasetSummary;
  csvPreviewText: string;
}> {
  const res = await fetch(`/api/benchmarks/${presetId}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load benchmark dataset.');
  return data;
}

export async function uploadDatasetApi(payload: {
  mode: UploadMode;
  filename?: string;
  csvContent?: string;
  normalFilename?: string;
  normalCsvContent?: string;
  ldosFilename?: string;
  ldosCsvContent?: string;
  signalColumn?: string;
}): Promise<{ datasetId: string; summary: DatasetSummary }> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Dataset upload failed.');
  return data;
}

export async function validateDatasetApi(payload: {
  datasetId: string;
  signalColumn: string;
  labelColumn: string | null;
}): Promise<{ datasetId: string; summary: DatasetSummary }> {
  const res = await fetch('/api/validate-dataset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Dataset validation failed.');
  return data;
}

export async function runDetectionApi(config: DetectionConfig): Promise<DetectionJobResult> {
  const res = await fetch('/api/run-detection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Detection execution failed.');
  return data;
}

export function getDownloadUrl(
  jobId: string,
  fileType: 'predictions.csv' | 'features.csv' | 'metrics.csv'
): string {
  return `/api/download/${jobId}/${fileType}`;
}
