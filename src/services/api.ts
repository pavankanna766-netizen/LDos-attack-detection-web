import {
  BenchmarkPreset,
  DatasetSummary,
  DetectionConfig,
  DetectionJobResult,
  UploadMode,
} from '../types/ldos';
import {
  BENCHMARK_PRESETS,
  buildDatasetSummary,
  executeFullDetectionPipeline,
  generateBenchmarkCsv,
  parseCsvText,
} from './scientificEngine';

// Optional external Python FastAPI or Node backend URL (configurable in Vercel Environment Variables)
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

interface ClientDatasetSession {
  datasetId: string;
  filename: string;
  mode: UploadMode;
  columns: string[];
  rows: Record<string, string>[];
  summary: DatasetSummary;
}

// Browser-side session fallback store so Vercel static deployments work 100% standalone
const clientDatasetSessions = new Map<string, ClientDatasetSession>();
const clientDetectionJobs = new Map<string, DetectionJobResult>();

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function isJsonResponse(res: Response): Promise<boolean> {
  const ct = res.headers.get('content-type') || '';
  return res.ok && ct.includes('application/json');
}

export async function fetchBenchmarkPresets(): Promise<BenchmarkPreset[]> {
  try {
    const res = await fetch(`${API_BASE}/api/benchmarks`);
    if (await isJsonResponse(res)) {
      const data = await res.json();
      if (Array.isArray(data.presets)) return data.presets;
    }
  } catch {
    // Fallback to built-in scientificEngine on Vercel static hosting
  }
  return BENCHMARK_PRESETS;
}

export async function loadBenchmarkPreset(presetId: string): Promise<{
  datasetId: string;
  preset: BenchmarkPreset;
  summary: DatasetSummary;
  csvPreviewText: string;
}> {
  // Always keep a local copy in clientDatasetSessions so serverless/Vercel deployments never lose session state
  const { csvText, preset } = generateBenchmarkCsv(presetId);
  const { columns, rows } = parseCsvText(csvText);
  const localId = makeId('ds');
  const filename = `${preset.id}.csv`;
  const localSummary = buildDatasetSummary(
    localId,
    filename,
    'single',
    columns,
    rows,
    'traffic_packets',
    'label'
  );

  try {
    const res = await fetch(`${API_BASE}/api/benchmarks/${presetId}`, { method: 'POST' });
    if (await isJsonResponse(res)) {
      const data = await res.json();
      clientDatasetSessions.set(data.datasetId, {
        datasetId: data.datasetId,
        filename,
        mode: 'single',
        columns,
        rows,
        summary: data.summary,
      });
      return data;
    }
  } catch {
    // Use client scientificEngine fallback on Vercel
  }

  clientDatasetSessions.set(localId, {
    datasetId: localId,
    filename,
    mode: 'single',
    columns,
    rows,
    summary: localSummary,
  });

  return {
    datasetId: localId,
    preset,
    summary: localSummary,
    csvPreviewText: csvText.split('\n').slice(0, 25).join('\n'),
  };
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
  // Parse locally first so clientDatasetSessions always has the dataset on Vercel
  const localId = makeId('ds');
  let localSession: ClientDatasetSession;

  if (payload.mode === 'dual') {
    if (!payload.normalCsvContent || !payload.ldosCsvContent) {
      throw new Error('Mode B requires both a Normal Traffic CSV file and an LDoS Attack CSV file.');
    }
    const parsedNormal = parseCsvText(payload.normalCsvContent);
    const parsedLdos = parseCsvText(payload.ldosCsvContent);
    const normSummary = buildDatasetSummary(
      'tmp_norm',
      payload.normalFilename || 'normal.csv',
      'single',
      parsedNormal.columns,
      parsedNormal.rows,
      payload.signalColumn,
      null
    );
    const ldosSummary = buildDatasetSummary(
      'tmp_ldos',
      payload.ldosFilename || 'ldos.csv',
      'single',
      parsedLdos.columns,
      parsedLdos.rows,
      payload.signalColumn,
      null
    );
    const targetSigCol = payload.signalColumn || normSummary.selectedSignalColumn;
    const ldosSigCol = parsedLdos.columns.includes(targetSigCol)
      ? targetSigCol
      : ldosSummary.selectedSignalColumn;

    const mergedColumns = Array.from(
      new Set([...parsedNormal.columns, 'traffic_signal', 'label'])
    );
    const mergedRows: Record<string, string>[] = [];
    parsedNormal.rows.forEach((r, idx) => {
      mergedRows.push({
        ...r,
        sample_index: String(idx),
        traffic_signal: r[targetSigCol] ?? '0',
        label: '0',
      });
    });
    const offset = mergedRows.length;
    parsedLdos.rows.forEach((r, idx) => {
      mergedRows.push({
        ...r,
        sample_index: String(offset + idx),
        traffic_signal: r[ldosSigCol] ?? '0',
        label: '1',
      });
    });
    const combinedFilename = `${payload.normalFilename || 'normal.csv'} + ${
      payload.ldosFilename || 'ldos.csv'
    }`;
    const summary = buildDatasetSummary(
      localId,
      combinedFilename,
      'dual',
      mergedColumns,
      mergedRows,
      'traffic_signal',
      'label'
    );
    localSession = {
      datasetId: localId,
      filename: combinedFilename,
      mode: 'dual',
      columns: mergedColumns,
      rows: mergedRows,
      summary,
    };
  } else {
    if (!payload.csvContent) {
      throw new Error('Please provide a valid CSV file to upload.');
    }
    const { columns, rows } = parseCsvText(payload.csvContent);
    const fname = payload.filename || 'dataset.csv';
    const summary = buildDatasetSummary(localId, fname, 'single', columns, rows);
    localSession = {
      datasetId: localId,
      filename: fname,
      mode: 'single',
      columns,
      rows,
      summary,
    };
  }

  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (await isJsonResponse(res)) {
      const data = await res.json();
      clientDatasetSessions.set(data.datasetId, {
        ...localSession,
        datasetId: data.datasetId,
        summary: data.summary,
      });
      return data;
    }
  } catch {
    // Fallback to browser session on Vercel
  }

  clientDatasetSessions.set(localId, localSession);
  return { datasetId: localId, summary: localSession.summary };
}

export async function validateDatasetApi(payload: {
  datasetId: string;
  signalColumn: string;
  labelColumn: string | null;
}): Promise<{ datasetId: string; summary: DatasetSummary }> {
  try {
    const res = await fetch(`${API_BASE}/api/validate-dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (await isJsonResponse(res)) {
      const data = await res.json();
      const existing = clientDatasetSessions.get(payload.datasetId);
      if (existing) existing.summary = data.summary;
      return data;
    }
  } catch {
    // Fallback to browser session on Vercel
  }

  const session = clientDatasetSessions.get(payload.datasetId);
  if (!session) {
    throw new Error('Uploaded dataset session not found. Please re-upload.');
  }
  const updatedSummary = buildDatasetSummary(
    session.datasetId,
    session.filename,
    session.mode,
    session.columns,
    session.rows,
    payload.signalColumn,
    payload.labelColumn
  );
  session.summary = updatedSummary;
  return { datasetId: payload.datasetId, summary: updatedSummary };
}

export async function runDetectionApi(config: DetectionConfig): Promise<DetectionJobResult> {
  try {
    const res = await fetch(`${API_BASE}/api/run-detection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (await isJsonResponse(res)) {
      const data: DetectionJobResult = await res.json();
      clientDetectionJobs.set(data.jobId, data);
      return data;
    }
  } catch {
    // Fallback to browser scientificEngine execution on Vercel static hosting
  }

  const session = clientDatasetSessions.get(config.datasetId);
  if (!session) {
    throw new Error('Dataset session expired or not found. Please select or upload a dataset first.');
  }
  const activeSummary = buildDatasetSummary(
    session.datasetId,
    session.filename,
    session.mode,
    session.columns,
    session.rows,
    config.signalColumn,
    config.labelColumn
  );
  session.summary = activeSummary;
  const jobId = makeId('job');
  const result = executeFullDetectionPipeline(jobId, activeSummary, session.rows, config);
  clientDetectionJobs.set(jobId, result);
  return result;
}

export function getDownloadUrl(
  jobId: string,
  fileType: 'predictions.csv' | 'features.csv' | 'metrics.csv'
): string {
  const job = clientDetectionJobs.get(jobId);
  if (job && typeof window !== 'undefined' && typeof URL !== 'undefined') {
    let csvContent = '';
    if (fileType === 'predictions.csv') {
      const headers = [
        'window_number',
        'start_time_s',
        'end_time_s',
        'prediction_code',
        'prediction_label',
        'true_label',
        'confidence',
        'split_set',
      ];
      const lines = [headers.join(',')];
      job.windowPredictions.forEach((wp) => {
        lines.push(
          [
            wp.windowIndex + 1,
            wp.startTime,
            wp.endTime,
            wp.prediction,
            wp.prediction === 1 ? 'LDoS Attack' : 'Normal Traffic',
            wp.trueLabel !== null ? wp.trueLabel : 'N/A',
            wp.confidence.toFixed(4),
            wp.isTestWindow ? 'Test' : 'Train',
          ].join(',')
        );
      });
      csvContent = lines.join('\n');
    } else if (fileType === 'features.csv') {
      const featCols = job.featureNames;
      const headers = [
        'window_number',
        'start_time_s',
        'end_time_s',
        ...featCols,
        'predicted_label',
        'true_label',
      ];
      const lines = [headers.join(',')];
      job.windowPredictions.forEach((wp) => {
        const featVals = featCols.map((k) => (wp.features[k] ?? 0).toFixed(6));
        lines.push(
          [
            wp.windowIndex + 1,
            wp.startTime,
            wp.endTime,
            ...featVals,
            wp.prediction,
            wp.trueLabel !== null ? wp.trueLabel : 'N/A',
          ].join(',')
        );
      });
      csvContent = lines.join('\n');
    } else if (fileType === 'metrics.csv') {
      const m = job.metrics;
      const headers = [
        'job_id',
        'dataset',
        'transform',
        'feature_set',
        'model',
        'split_strategy',
        'accuracy',
        'precision',
        'recall_tpr',
        'specificity_tnr',
        'f1_score',
        'false_positive_rate',
        'tp',
        'tn',
        'fp',
        'fn',
        'total_windows',
        'normal_windows',
        'ldos_windows',
      ];
      const row = [
        job.jobId,
        `"${job.datasetSummary.filename}"`,
        job.config.transform,
        job.config.featureSet,
        job.config.model,
        job.config.splitStrategy,
        m.accuracy.toFixed(4),
        m.precision.toFixed(4),
        m.recall.toFixed(4),
        m.specificity.toFixed(4),
        m.f1Score.toFixed(4),
        m.fpr.toFixed(4),
        m.confusionMatrix.tp,
        m.confusionMatrix.tn,
        m.confusionMatrix.fp,
        m.confusionMatrix.fn,
        m.totalWindowsCount,
        m.normalWindowsCount,
        m.ldosWindowsCount,
      ];
      csvContent = `${headers.join(',')}\n${row.join(',')}`;
    }
    if (csvContent) {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      return URL.createObjectURL(blob);
    }
  }
  return `${API_BASE}/api/download/${jobId}/${fileType}`;
}
