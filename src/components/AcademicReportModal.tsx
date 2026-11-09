import React from 'react';
import { X, Printer, Download, FileText } from 'lucide-react';
import { DetectionJobResult, ExperimentComparisonItem } from '../types/ldos';

interface AcademicReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: DetectionJobResult | null;
  experiments: ExperimentComparisonItem[];
}

export const AcademicReportModal: React.FC<AcademicReportModalProps> = ({
  isOpen,
  onClose,
  result,
  experiments,
}) => {
  if (!isOpen || !result) return null;

  const { datasetSummary, config, metrics, featureSummaryByClass, windowPredictions } = result;

  const handleDownloadStandaloneHtml = () => {
    const reportEl = document.getElementById('printable-academic-report');
    if (!reportEl) return;

    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>LDoS Detection Academic Report — ${result.jobId}</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, Helvetica, sans-serif; color: #0f172a; max-width: 960px; margin: 32px auto; padding: 0 24px; line-height: 1.55; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 16px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-top: 28px; }
    .meta { font-size: 13px; color: #475569; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-variant-numeric: tabular-nums; }
    th { background: #f1f5f9; font-weight: 600; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
    .kpi-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc; }
    .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
    .kpi-val { font-size: 22px; font-weight: 700; font-family: monospace; margin-top: 4px; }
    .verdict { padding: 12px 16px; border-radius: 6px; font-weight: 700; margin: 16px 0; border: 1px solid #94a3b8; }
  </style>
</head>
<body>
  ${reportEl.innerHTML}
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ldos_academic_report_${result.jobId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 no-print">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Academic Evaluation Report · Job {result.jobId}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadStandaloneHtml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download HTML Report
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg"
              aria-label="Close report modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div
          id="printable-academic-report"
          className="p-6 md:p-8 overflow-y-auto space-y-6 text-slate-900 dark:text-slate-100 text-sm"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h1 className="text-xl font-bold tracking-tight">
              LDoS Attack Detection — Signals & Systems Experimental Report
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Methodology: Wang et al. (2024), &ldquo;An LDoS attack detection method based on FSWT
              time–frequency distribution&rdquo;, Expert Systems With Applications, 256, 125006 ·
              Generated {new Date(result.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Primary Verdict */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Overall Classification Verdict</div>
              <div className="text-lg font-bold font-mono mt-0.5">
                {metrics.overallVerdict === 'LDOS_DETECTED'
                  ? 'LDoS ATTACK DETECTED (Class 1)'
                  : 'NORMAL TRAFFIC STATUS (Class 0)'}
              </div>
            </div>
            <div className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums">
              Total Windows: {metrics.totalWindowsCount} · Normal (0): {metrics.normalWindowsCount} ·
              LDoS (1): {metrics.ldosWindowsCount} ({metrics.ldosPercentage.toFixed(1)}%) · Mean
              Confidence: {(metrics.meanConfidence * 100).toFixed(1)}%
            </div>
          </div>

          {/* Section 1: Dataset & Signal Configuration */}
          <div>
            <h2 className="text-sm font-semibold border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-3">
              1. Dataset & Signal Processing Configuration
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400">Dataset File</div>
                <div className="font-mono font-semibold mt-1 truncate">{datasetSummary.filename}</div>
              </div>
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400">Signal Windowing</div>
                <div className="font-mono font-semibold mt-1 tabular-nums">
                  fs={config.samplingRate} Hz · N={config.windowSize} ({(config.windowSize / config.samplingRate).toFixed(1)}s)
                </div>
              </div>
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400">Transform & Features</div>
                <div className="font-mono font-semibold mt-1">
                  {config.transform} · {config.featureSet === 'original_4' ? '4 Paper Features' : '6 Extended Features'}
                </div>
              </div>
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400">Classifier & Split</div>
                <div className="font-mono font-semibold mt-1">
                  {config.model === 'decision_tree' ? 'Decision Tree' : 'Random Forest'} · {config.splitStrategy} (30% Test)
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Evaluation Metrics & Confusion Matrix */}
          <div>
            <h2 className="text-sm font-semibold border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-3">
              2. Machine Learning Evaluation Metrics (Wang et al., Eq. 7–10)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 font-mono text-xs tabular-nums">
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400 font-sans">Accuracy</div>
                <div className="text-base font-bold mt-1">{(metrics.accuracy * 100).toFixed(2)}%</div>
              </div>
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400 font-sans">Precision</div>
                <div className="text-base font-bold mt-1">{(metrics.precision * 100).toFixed(2)}%</div>
              </div>
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400 font-sans">Recall (TPR)</div>
                <div className="text-base font-bold mt-1">{(metrics.recall * 100).toFixed(2)}%</div>
              </div>
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400 font-sans">Specificity (TNR)</div>
                <div className="text-base font-bold mt-1">{(metrics.specificity * 100).toFixed(2)}%</div>
              </div>
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400 font-sans">F1 Score</div>
                <div className="text-base font-bold mt-1">{(metrics.f1Score * 100).toFixed(2)}%</div>
              </div>
              <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400 font-sans">False Pos. Rate</div>
                <div className="text-base font-bold mt-1">{(metrics.fpr * 100).toFixed(2)}%</div>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-slate-200 dark:border-slate-800 font-mono tabular-nums">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Confusion Matrix (Test Set)</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Detected: Normal Status (NS=0)</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Detected: LDoS Status (LS=1)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-slate-200 dark:border-slate-800 font-semibold">Actual: Normal (NS=0)</td>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">TN = {metrics.confusionMatrix.tn}</td>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">FP = {metrics.confusionMatrix.fp}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-200 dark:border-slate-800 font-semibold">Actual: LDoS (LS=1)</td>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">FN = {metrics.confusionMatrix.fn}</td>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">TP = {metrics.confusionMatrix.tp}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Extracted Time-Frequency Feature Summary */}
          <div>
            <h2 className="text-sm font-semibold border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-3">
              3. Extracted Time-Frequency Feature Statistics (Normal vs. LDoS Windows)
            </h2>
            <table className="w-full text-xs border-collapse border border-slate-200 dark:border-slate-800 font-mono tabular-nums">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Feature Name</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Normal Traffic (NS=0) Mean ± Std</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">LDoS Attack (LS=1) Mean ± Std</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Gini Importance</th>
                </tr>
              </thead>
              <tbody>
                {featureSummaryByClass.map((f) => (
                  <tr key={f.feature}>
                    <td className="p-2 border border-slate-200 dark:border-slate-800 font-semibold">{f.feature}</td>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">
                      {f.normalMean.toFixed(4)} ± {f.normalStd.toFixed(4)}
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">
                      {f.ldosMean.toFixed(4)} ± {f.ldosStd.toFixed(4)}
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">
                      {((result.featureImportances[f.feature] ?? 0) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 4: Comparative Experiments Executed */}
          {experiments.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-3">
                4. Comparative Experiments Summary
              </h2>
              <table className="w-full text-xs border-collapse border border-slate-200 dark:border-slate-800 font-mono tabular-nums">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Experiment</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Transform</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Features</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Model</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">Accuracy</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">F1 Score</th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700">FPR</th>
                  </tr>
                </thead>
                <tbody>
                  {experiments.map((exp) => (
                    <tr key={exp.experimentId}>
                      <td className="p-2 border border-slate-200 dark:border-slate-800 font-sans font-medium">
                        {exp.experimentName}
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-800">{exp.transform}</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-800">{exp.featureCount} Features</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-800">
                        {exp.model === 'decision_tree' ? 'Decision Tree' : 'Random Forest'}
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-800">
                        {(exp.accuracy * 100).toFixed(2)}%
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-800">
                        {(exp.f1Score * 100).toFixed(2)}%
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-800">
                        {(exp.fpr * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 5: Sample Window Predictions */}
          <div>
            <h2 className="text-sm font-semibold border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-3">
              5. Window-Level Classification Results (First 15 Windows)
            </h2>
            <table className="w-full text-xs border-collapse border border-slate-200 dark:border-slate-800 font-mono tabular-nums">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Window #</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Time Range (s)</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Prediction</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">True Label</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {windowPredictions.slice(0, 15).map((wp) => (
                  <tr key={wp.windowIndex}>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">#{wp.windowIndex + 1}</td>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">
                      {wp.startTime.toFixed(1)}s – {wp.endTime.toFixed(1)}s
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">
                      {wp.prediction === 1 ? 'LDoS Attack (1)' : 'Normal Traffic (0)'}
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">
                      {wp.trueLabel !== null ? (wp.trueLabel === 1 ? 'LDoS (1)' : 'Normal (0)') : 'Unlabelled'}
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-800">
                      {(wp.confidence * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
