import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Download,
} from 'lucide-react';
import {
  BenchmarkPreset,
  DatasetSummary,
  DetectionConfig,
  UploadMode,
} from '../types/ldos';
import { generateBenchmarkCsv } from '../services/scientificEngine';

interface DatasetUploadPageProps {
  benchmarks: BenchmarkPreset[];
  summary: DatasetSummary | null;
  config: DetectionConfig;
  onUpdateConfig: (partial: Partial<DetectionConfig>) => void;
  onUploadDataset: (payload: {
    mode: UploadMode;
    filename?: string;
    csvContent?: string;
    normalFilename?: string;
    normalCsvContent?: string;
    ldosFilename?: string;
    ldosCsvContent?: string;
  }) => Promise<void>;
  onSelectBenchmark: (presetId: string) => Promise<void>;
  onRevalidateColumns: (signalColumn: string, labelColumn: string | null) => Promise<void>;
  onProceedToConfig: () => void;
  isUploading: boolean;
  uploadError: string | null;
}

export const DatasetUploadPage: React.FC<DatasetUploadPageProps> = ({
  benchmarks,
  summary,
  config,
  onUpdateConfig,
  onUploadDataset,
  onSelectBenchmark,
  onRevalidateColumns,
  onProceedToConfig,
  isUploading,
  uploadError,
}) => {
  const [mode, setMode] = useState<UploadMode>('single');
  const [normalFileState, setNormalFileState] = useState<{ name: string; content: string } | null>(
    null
  );
  const [ldosFileState, setLdosFileState] = useState<{ name: string; content: string } | null>(
    null
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSingleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setLocalError('Invalid file format. Please upload a .csv file.');
      return;
    }
    const text = await file.text();
    await onUploadDataset({
      mode: 'single',
      filename: file.name,
      csvContent: text,
    });
  };

  const handleDualFileRead = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'normal' | 'ldos'
  ) => {
    setLocalError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setLocalError('Both files in Mode B must be .csv files.');
      return;
    }
    const text = await file.text();
    if (target === 'normal') {
      setNormalFileState({ name: file.name, content: text });
    } else {
      setLdosFileState({ name: file.name, content: text });
    }
  };

  const handleMergeAndUploadDual = async () => {
    if (!normalFileState || !ldosFileState) {
      setLocalError('Please select both the Normal Traffic CSV and LDoS Attack CSV files first.');
      return;
    }
    await onUploadDataset({
      mode: 'dual',
      normalFilename: normalFileState.name,
      normalCsvContent: normalFileState.content,
      ldosFilename: ldosFileState.name,
      ldosCsvContent: ldosFileState.content,
    });
  };

  const handleDownloadSampleCsv = (presetId: string) => {
    const { csvText, preset } = generateBenchmarkCsv(presetId);
    const blob = new Blob([csvText], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${preset.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalLabelled =
    (summary?.classDistribution.normal || 0) + (summary?.classDistribution.ldos || 0);
  const normalPct =
    totalLabelled > 0 ? ((summary?.classDistribution.normal || 0) / totalLabelled) * 100 : 0;
  const ldosPct =
    totalLabelled > 0 ? ((summary?.classDistribution.ldos || 0) / totalLabelled) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            1. Dataset Upload & Signal Validation
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Upload a custom network traffic CSV dataset (Mode A or Mode B) or load a calibrated
            benchmark capture from the reference paper.
          </p>
        </div>

        {summary && (
          <button
            type="button"
            onClick={onProceedToConfig}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Continue to Detection Configuration
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Upload Mode Selector + Benchmark Loader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Custom CSV Upload (Mode A & Mode B) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Upload Network Traffic CSV
            </h2>

            {/* Interactive Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mode === 'single'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Mode A: Single Labelled CSV
              </button>
              <button
                type="button"
                onClick={() => setMode('dual')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mode === 'dual'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Mode B: Separate Normal + LDoS CSVs
              </button>
            </div>
          </div>

          {mode === 'single' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Upload one CSV file containing a numeric network traffic/signal column and an
                optional class label column (<span className="font-mono">0 = Normal Traffic</span>,{' '}
                <span className="font-mono">1 = LDoS Attack</span>). Column names can be customized
                below after upload.
              </p>

              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-400 rounded-xl p-8 cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-950/40">
                <Upload className="w-8 h-8 text-cyan-600 dark:text-cyan-400 mb-2.5" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {isUploading ? 'Parsing & Validating CSV...' : 'Click to select a CSV dataset file'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Supports any column schema (.csv) · Automatic numeric & label detection
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleSingleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Upload two separate CSV captures: one recorded during Normal Traffic (<span className="font-mono">NS = 0</span>)
                and one recorded during an LDoS Attack (<span className="font-mono">LS = 1</span>).
                The backend will automatically assign class labels and merge them for windowed
                evaluation.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-lg p-5 cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-950/40">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mb-2" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-center">
                    {normalFileState ? normalFileState.name : '1. Upload Normal Traffic CSV (Class 0)'}
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => handleDualFileRead(e, 'normal')}
                    className="hidden"
                  />
                </label>

                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-500 rounded-lg p-5 cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-950/40">
                  <FileSpreadsheet className="w-6 h-6 text-rose-600 dark:text-rose-400 mb-2" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-center">
                    {ldosFileState ? ldosFileState.name : '2. Upload LDoS Attack CSV (Class 1)'}
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => handleDualFileRead(e, 'ldos')}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="button"
                disabled={!normalFileState || !ldosFileState || isUploading}
                onClick={handleMergeAndUploadDual}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                {isUploading ? 'Merging & Validating Datasets...' : 'Validate & Merge Dual CSV Datasets'}
              </button>
            </div>
          )}

          {(localError || uploadError) && (
            <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{localError || uploadError}</span>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Built-in Paper Benchmark Datasets */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Reference Paper Benchmark Datasets
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Load directly for testing or download as .csv to test manual upload
              </p>
            </div>
            <Database className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
          </div>

          <div className="space-y-2.5">
            {benchmarks.map((b) => {
              const isSelected = summary?.filename === `${b.id}.csv`;
              return (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {b.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {b.environment} · T={b.attackParams.T}s · L={b.attackParams.L}s · R=
                        {b.attackParams.R} Mbps · {b.totalSamples} samples
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => onSelectBenchmark(b.id)}
                      className="px-3 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {isSelected ? 'Loaded in Session' : 'Load Dataset'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadSampleCsv(b.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3 h-3" />
                      Download .CSV
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Column Mapping, Signal Windowing Parameters & Dataset Summary */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 5 Cols: Column Mapping & Signal Windowing Configuration */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Column Selection & Signal Parameters
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Map your CSV columns and configure time-series windowing
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Traffic / Signal Amplitude Column
                </label>
                <select
                  value={config.signalColumn}
                  onChange={(e) => {
                    const newSig = e.target.value;
                    onUpdateConfig({ signalColumn: newSig });
                    onRevalidateColumns(newSig, config.labelColumn);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
                >
                  {summary.columns.map((col) => (
                    <option key={col} value={col}>
                      {col} {summary.numericColumns.includes(col) ? '(numeric)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Class Label Column (0 = Normal, 1 = LDoS Attack)
                </label>
                <select
                  value={config.labelColumn || '__NONE__'}
                  onChange={(e) => {
                    const newLbl = e.target.value === '__NONE__' ? null : e.target.value;
                    onUpdateConfig({ labelColumn: newLbl });
                    onRevalidateColumns(config.signalColumn, newLbl);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
                >
                  <option value="__NONE__">-- Unlabelled Dataset (Unsupervised Thresholding) --</option>
                  {summary.columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Sampling Rate (Hz)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    value={config.samplingRate}
                    onChange={(e) =>
                      onUpdateConfig({ samplingRate: Math.max(1, Number(e.target.value) || 10) })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Window Size (N)
                  </label>
                  <input
                    type="number"
                    min={16}
                    max={2048}
                    step={10}
                    value={config.windowSize}
                    onChange={(e) => {
                      const wSize = Math.max(16, Number(e.target.value) || 100);
                      onUpdateConfig({ windowSize: wSize, windowStride: wSize });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Window Stride
                  </label>
                  <input
                    type="number"
                    min={8}
                    max={2048}
                    step={10}
                    value={config.windowStride}
                    onChange={(e) =>
                      onUpdateConfig({ windowStride: Math.max(8, Number(e.target.value) || 100) })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                Window Duration:{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {(config.windowSize / config.samplingRate).toFixed(2)} seconds
                </strong>{' '}
                · Est. Total Windows:{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {Math.max(
                    0,
                    Math.floor((summary.numRows - config.windowSize) / config.windowStride) + 1
                  )}
                </strong>
              </div>
            </div>
          </div>

          {/* Right 7 Cols: Validated Dataset Summary & Preview Table */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Validated Dataset Summary
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                ID: {summary.datasetId}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400">Filename</div>
                <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-1 truncate">
                  {summary.filename}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400">Rows & Columns</div>
                <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                  {summary.numRows.toLocaleString()} rows · {summary.numColumns} cols
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400">Selected Signal Column</div>
                <div className="font-mono font-semibold text-cyan-600 dark:text-cyan-400 mt-1 truncate">
                  {summary.selectedSignalColumn}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400">Selected Label Column</div>
                <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-1 truncate">
                  {summary.selectedLabelColumn || 'None (Unlabelled)'}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400">Missing Signal Values</div>
                <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                  {summary.missingValues} {summary.missingValues > 0 ? '(Auto-interpolated)' : '(Clean)'}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-slate-500 dark:text-slate-400">Signal Mean ± Std</div>
                <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                  {summary.signalStats.mean.toFixed(2)} ± {summary.signalStats.std.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Class Distribution Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-600 dark:text-slate-300">
                  Class Distribution — Normal (0): {summary.classDistribution.normal.toLocaleString()} (
                  {normalPct.toFixed(1)}%)
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  LDoS Attack (1): {summary.classDistribution.ldos.toLocaleString()} (
                  {ldosPct.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${normalPct}%` }}
                />
                <div
                  className="bg-rose-500 h-full transition-all"
                  style={{ width: `${ldosPct}%` }}
                />
              </div>
            </div>

            {/* Data Preview Table */}
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Sample Rows Preview (First 5 records)
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-xs font-mono tabular-nums text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      {summary.columns.map((col) => (
                        <th
                          key={col}
                          className="py-2 px-3 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {summary.previewRows.slice(0, 5).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {summary.columns.map((col) => (
                          <td key={col} className="py-1.5 px-3 text-slate-600 dark:text-slate-300">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
