import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  BENCHMARK_PRESETS,
  buildDatasetSummary,
  executeFullDetectionPipeline,
  generateBenchmarkCsv,
  parseCsvText,
} from './src/services/scientificEngine.ts';
import {
  DatasetSummary,
  DetectionConfig,
  DetectionJobResult,
  UploadMode,
} from './src/types/ldos.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StoredDatasetSession {
  datasetId: string;
  filename: string;
  mode: UploadMode;
  columns: string[];
  rows: Record<string, string>[];
  summary: DatasetSummary;
}

const datasetSessions = new Map<string, StoredDatasetSession>();
const detectionJobs = new Map<string, DetectionJobResult>();

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large CSV uploads up to 50MB
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 1. Health & Benchmark Presets Endpoints
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      engine: 'LDoS Signal Processing & Machine Learning Pipeline (Wang et al., 2024)',
    });
  });

  app.get('/api/benchmarks', (_req, res) => {
    res.json({ presets: BENCHMARK_PRESETS });
  });

  app.post('/api/benchmarks/:presetId', (req, res) => {
    try {
      const { presetId } = req.params;
      const { csvText, preset } = generateBenchmarkCsv(presetId);
      const { columns, rows } = parseCsvText(csvText);
      const datasetId = generateId('ds');
      const filename = `${preset.id}.csv`;
      const summary = buildDatasetSummary(
        datasetId,
        filename,
        'single',
        columns,
        rows,
        'traffic_packets',
        'label'
      );

      datasetSessions.set(datasetId, {
        datasetId,
        filename,
        mode: 'single',
        columns,
        rows,
        summary,
      });

      res.json({
        datasetId,
        preset,
        summary,
        csvPreviewText: csvText.split('\n').slice(0, 25).join('\n'),
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to load benchmark dataset.',
      });
    }
  });

  // 2. POST /api/upload — Supports Mode A (single CSV) and Mode B (dual Normal + LDoS CSVs)
  app.post('/api/upload', (req, res) => {
    try {
      const {
        mode = 'single',
        filename = 'dataset.csv',
        csvContent,
        normalFilename = 'normal_traffic.csv',
        normalCsvContent,
        ldosFilename = 'ldos_attack.csv',
        ldosCsvContent,
        signalColumn,
      } = req.body;

      const datasetId = generateId('ds');

      if (mode === 'dual') {
        if (!normalCsvContent || !ldosCsvContent) {
          return res.status(400).json({
            error: 'Mode B requires both a Normal Traffic CSV file and an LDoS Attack CSV file.',
          });
        }
        const parsedNormal = parseCsvText(normalCsvContent);
        const parsedLdos = parseCsvText(ldosCsvContent);

        // Determine shared signal column or map primary numeric column
        const normSummary = buildDatasetSummary(
          'tmp_norm',
          normalFilename,
          'single',
          parsedNormal.columns,
          parsedNormal.rows,
          signalColumn,
          null
        );
        const ldosSummary = buildDatasetSummary(
          'tmp_ldos',
          ldosFilename,
          'single',
          parsedLdos.columns,
          parsedLdos.rows,
          signalColumn,
          null
        );

        const targetSigCol = signalColumn || normSummary.selectedSignalColumn;
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

        const combinedFilename = `${normalFilename} + ${ldosFilename}`;
        const summary = buildDatasetSummary(
          datasetId,
          combinedFilename,
          'dual',
          mergedColumns,
          mergedRows,
          'traffic_signal',
          'label'
        );

        datasetSessions.set(datasetId, {
          datasetId,
          filename: combinedFilename,
          mode: 'dual',
          columns: mergedColumns,
          rows: mergedRows,
          summary,
        });

        return res.json({ datasetId, summary });
      }

      // Mode A: Single CSV dataset
      if (!csvContent) {
        return res.status(400).json({ error: 'Please provide a valid CSV file to upload.' });
      }
      const { columns, rows } = parseCsvText(csvContent);
      const summary = buildDatasetSummary(datasetId, filename, 'single', columns, rows);

      datasetSessions.set(datasetId, {
        datasetId,
        filename,
        mode: 'single',
        columns,
        rows,
        summary,
      });

      return res.json({ datasetId, summary });
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to parse uploaded CSV dataset.',
      });
    }
  });

  // 3. POST /api/validate-dataset — Re-validates when user changes signal or label column
  app.post('/api/validate-dataset', (req, res) => {
    try {
      const { datasetId, signalColumn, labelColumn } = req.body;
      const session = datasetSessions.get(datasetId);
      if (!session) {
        return res.status(404).json({ error: 'Uploaded dataset session not found. Please re-upload.' });
      }

      const updatedSummary = buildDatasetSummary(
        session.datasetId,
        session.filename,
        session.mode,
        session.columns,
        session.rows,
        signalColumn,
        labelColumn
      );

      session.summary = updatedSummary;
      return res.json({ datasetId, summary: updatedSummary });
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Dataset validation error.',
      });
    }
  });

  // 4. POST /api/run-detection — Executes the complete scientific signal & ML pipeline
  app.post('/api/run-detection', (req, res) => {
    try {
      const config: DetectionConfig = req.body;
      const session = datasetSessions.get(config.datasetId);
      if (!session) {
        return res.status(404).json({
          error: 'Dataset session expired or not found. Please select or upload a dataset first.',
        });
      }

      // Refresh summary with the user's selected columns
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

      const jobId = generateId('job');
      const result = executeFullDetectionPipeline(jobId, activeSummary, session.rows, config);
      detectionJobs.set(jobId, result);

      return res.json(result);
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Error running LDoS detection pipeline.',
      });
    }
  });

  // 5. GET /api/results/:job_id
  app.get('/api/results/:job_id', (req, res) => {
    const job = detectionJobs.get(req.params.job_id);
    if (!job) {
      return res.status(404).json({ error: 'Detection job result not found.' });
    }
    return res.json(job);
  });

  // 6. GET /api/results/:job_id/metrics
  app.get('/api/results/:job_id/metrics', (req, res) => {
    const job = detectionJobs.get(req.params.job_id);
    if (!job) {
      return res.status(404).json({ error: 'Detection job metrics not found.' });
    }
    return res.json(job.metrics);
  });

  // 7. GET /api/results/:job_id/visualizations
  app.get('/api/results/:job_id/visualizations', (req, res) => {
    const job = detectionJobs.get(req.params.job_id);
    if (!job) {
      return res.status(404).json({ error: 'Detection job visualizations not found.' });
    }
    return res.json(job.visualizations);
  });

  // 8. GET /api/download/:job_id/:file — Generates downloadable CSV and HTML/PDF report artifacts
  app.get('/api/download/:job_id/:file', (req, res) => {
    const job = detectionJobs.get(req.params.job_id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found for download.' });
    }

    const fileType = req.params.file;

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
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ldos_predictions_${job.jobId}.csv"`
      );
      return res.send(lines.join('\n'));
    }

    if (fileType === 'features.csv') {
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
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ldos_features_${job.config.transform}_${job.jobId}.csv"`
      );
      return res.send(lines.join('\n'));
    }

    if (fileType === 'metrics.csv') {
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
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ldos_evaluation_metrics_${job.jobId}.csv"`
      );
      return res.send(`${headers.join(',')}\n${row.join(',')}`);
    }

    return res.status(400).json({ error: 'Unsupported download artifact type.' });
  });

  // Mount Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LDoS Attack Detector Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
