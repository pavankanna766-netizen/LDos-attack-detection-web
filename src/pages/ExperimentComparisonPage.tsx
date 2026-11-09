import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts';
import {
  Play,
  Loader2,
  FlaskConical,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  DatasetSummary,
  ExperimentComparisonItem,
  FeatureSetType,
  ModelType,
  TransformType,
} from '../types/ldos';

interface ExperimentComparisonPageProps {
  summary: DatasetSummary | null;
  experiments: ExperimentComparisonItem[];
  onRunSpecificExperiment: (spec: {
    experimentName: string;
    transform: TransformType;
    featureSet: FeatureSetType;
    model: ModelType;
    isPaperBaseline?: boolean;
  }) => Promise<void>;
  onRunAllStandardExperiments: () => Promise<void>;
  onDeleteExperiment: (experimentId: string) => Promise<void>;
  onClearExperiments: () => Promise<void>;
  isRunningBatch: boolean;
  runningExperimentName: string | null;
  onGoToUpload: () => void;
}

export const ExperimentComparisonPage: React.FC<ExperimentComparisonPageProps> = ({
  summary,
  experiments,
  onRunSpecificExperiment,
  onRunAllStandardExperiments,
  onDeleteExperiment,
  onClearExperiments,
  isRunningBatch,
  runningExperimentName,
  onGoToUpload,
}) => {
  const bestTransform: TransformType = (() => {
    const dtExps = experiments.filter((e) => e.model === 'decision_tree');
    if (dtExps.length === 0) return 'FSWT';
    const sorted = [...dtExps].sort((a, b) => b.f1Score - a.f1Score);
    return sorted[0].transform;
  })();

  const standardProtocolSpecs: {
    id: string;
    experimentName: string;
    transform: TransformType;
    featureSet: FeatureSetType;
    model: ModelType;
    isPaperBaseline?: boolean;
    desc: string;
  }[] = [
    {
      id: 'exp1',
      experimentName: 'Experiment 1 ★ (Paper Baseline)',
      transform: 'FSWT',
      featureSet: 'original_4',
      model: 'decision_tree',
      isPaperBaseline: true,
      desc: 'FSWT + 4 Original Paper Features + Decision Tree',
    },
    {
      id: 'exp2',
      experimentName: 'Experiment 2',
      transform: 'FSWT',
      featureSet: 'extended_6',
      model: 'decision_tree',
      desc: 'FSWT + 6 Extended Features + Decision Tree',
    },
    {
      id: 'exp3',
      experimentName: 'Experiment 3',
      transform: 'STFT',
      featureSet: 'extended_6',
      model: 'decision_tree',
      desc: 'STFT + 6 Extended Features + Decision Tree',
    },
    {
      id: 'exp4',
      experimentName: 'Experiment 4',
      transform: 'CWT',
      featureSet: 'extended_6',
      model: 'decision_tree',
      desc: 'CWT + 6 Extended Features + Decision Tree',
    },
    {
      id: 'exp5',
      experimentName: 'Experiment 5',
      transform: 'FSWT',
      featureSet: 'original_4',
      model: 'random_forest',
      desc: 'FSWT + 4 Original Paper Features + Random Forest',
    },
    {
      id: 'exp6',
      experimentName: `Experiment 6 (Best Transform: ${bestTransform})`,
      transform: bestTransform,
      featureSet: 'extended_6',
      model: 'random_forest',
      desc: `${bestTransform} + 6 Extended Features + Random Forest`,
    },
  ];

  const handleExportComparisonCsv = () => {
    if (experiments.length === 0) return;
    const headers = [
      'Experiment',
      'Dataset',
      'Transform',
      'Features',
      'Model',
      'Accuracy',
      'Precision',
      'Recall',
      'F1_Score',
      'False_Positive_Rate',
    ];
    const rows = experiments.map((e) =>
      [
        `"${e.experimentName}"`,
        `"${e.datasetFilename}"`,
        e.transform,
        `${e.featureCount} Features (${e.featureSet})`,
        e.model === 'decision_tree' ? 'Decision Tree' : 'Random Forest',
        e.accuracy.toFixed(4),
        e.precision.toFixed(4),
        e.recall.toFixed(4),
        e.f1Score.toFixed(4),
        e.fpr.toFixed(4),
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ldos_experiment_comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = experiments.map((exp) => ({
    name: `${exp.transform} + ${exp.featureCount}F (${exp.model === 'decision_tree' ? 'DT' : 'RF'})`,
    Accuracy: Number((exp.accuracy * 100).toFixed(2)),
    Precision: Number((exp.precision * 100).toFixed(2)),
    Recall: Number((exp.recall * 100).toFixed(2)),
    'F1 Score': Number((exp.f1Score * 100).toFixed(2)),
    FPR: Number((exp.fpr * 100).toFixed(2)),
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Comparative Experiment Matrix
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Compare time–frequency transforms (FSWT, STFT, CWT), feature sets (4 vs. 6), and
            classifiers (Decision Tree vs. Random Forest). Only genuinely executed runs are shown.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {summary ? (
            <button
              type="button"
              disabled={isRunningBatch}
              onClick={onRunAllStandardExperiments}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isRunningBatch ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing {runningExperimentName || 'Experiments'}...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  Execute All 6 Comparative Experiments
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoToUpload}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors cursor-pointer"
            >
              Load Dataset to Run Experiments
            </button>
          )}

          {experiments.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportComparisonCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Export Comparison CSV
              </button>
              <button
                type="button"
                onClick={onClearExperiments}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Standard 6-Experiment Protocol Launcher */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Academic Comparative Protocol (Experiments 1 – 6)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {summary
                ? `Active Dataset: ${summary.filename} (${summary.numRows.toLocaleString()} samples) — Click any experiment below to run it on the backend.`
                : 'Load or upload a dataset first to execute the comparative experiments.'}
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Auto-Saved to Firestore (No Login Required)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {standardProtocolSpecs.map((spec) => {
            const alreadyExecuted = experiments.some(
              (e) =>
                e.transform === spec.transform &&
                e.featureSet === spec.featureSet &&
                e.model === spec.model
            );
            return (
              <div
                key={spec.id}
                className={`p-4 rounded-lg border flex flex-col justify-between gap-3 ${
                  alreadyExecuted
                    ? 'border-emerald-300 dark:border-emerald-800/70 bg-emerald-50/30 dark:bg-emerald-950/15'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                    <span>{spec.id.toUpperCase()}</span>
                    {alreadyExecuted && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {spec.experimentName}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mt-1">
                    {spec.desc}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!summary || isRunningBatch}
                  onClick={() => onRunSpecificExperiment(spec)}
                  className="w-full py-1.5 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-cyan-500 rounded transition-colors cursor-pointer disabled:opacity-50"
                >
                  {alreadyExecuted ? 'Re-Run Experiment' : 'Run Experiment'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Executed Experiments Table & Chart */}
      {experiments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
          <FlaskConical className="w-8 h-8 text-cyan-600 dark:text-cyan-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No Experiments Executed Yet
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            In compliance with scientific integrity requirements, this table never displays mocked
            or hardcoded metrics. Run a detection configuration or click{' '}
            <strong>&ldquo;Execute All 5 Comparative Experiments&rdquo;</strong> above to compute
            real evaluation results on your active dataset.
          </p>
          {!summary && (
            <div className="pt-2 flex items-center justify-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Please load or upload a dataset on the Dataset tab first.</span>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Comparison Table */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Executed Experiment Results ({experiments.length} Runs)
              </h2>
              <span className="text-xs font-mono text-slate-500">
                Computed from Actual Backend Pipeline Runs
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-xs font-mono tabular-nums text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 font-sans">
                      Experiment
                    </th>
                    <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">
                      Transform
                    </th>
                    <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">
                      Features
                    </th>
                    <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">
                      Model
                    </th>
                    <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 text-right">
                      Accuracy
                    </th>
                    <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 text-right">
                      Precision
                    </th>
                    <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 text-right">
                      Recall
                    </th>
                    <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 text-right">
                      F1 Score
                    </th>
                    <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 text-right">
                      False Positive Rate
                    </th>
                    <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {experiments.map((exp) => (
                    <tr
                      key={exp.experimentId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-slate-100">
                        {exp.experimentName}
                        <div className="text-[11px] font-mono font-normal text-slate-500">
                          {exp.datasetFilename}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-cyan-600 dark:text-cyan-400">
                        {exp.transform}
                      </td>
                      <td className="py-2.5 px-3">
                        {exp.featureCount === 4 ? 'Original 4 Features' : 'Extended 6 Features'}
                      </td>
                      <td className="py-2.5 px-3">
                        {exp.model === 'decision_tree' ? 'Decision Tree' : 'Random Forest'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {(exp.accuracy * 100).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {(exp.precision * 100).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {(exp.recall * 100).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-cyan-600 dark:text-cyan-400">
                        {(exp.f1Score * 100).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400">
                        {(exp.fpr * 100).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteExperiment(exp.experimentId)}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete experiment record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Comparative Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 Cols: Multi-Metric Grouped Bar Chart */}
            <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Comparative Classification Metrics (%)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Accuracy, Precision, Recall (TPR), and F1 Score across executed experiments
                </p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.22} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    />
                    <YAxis
                      domain={[0, 105]}
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      unit="%"
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
                      formatter={(val) => [`${Number(val ?? 0).toFixed(2)}%`]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                    <Bar dataKey="Accuracy" fill="#06b6d4" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="Accuracy"
                        position="top"
                        formatter={(v) => `${Number(v ?? 0).toFixed(1)}%`}
                        style={{ fontSize: '9.5px', fontFamily: 'JetBrains Mono', fill: '#06b6d4' }}
                      />
                    </Bar>
                    <Bar dataKey="Precision" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Recall" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="F1 Score" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="F1 Score"
                        position="top"
                        formatter={(v) => `${Number(v ?? 0).toFixed(1)}%`}
                        style={{ fontSize: '9.5px', fontFamily: 'JetBrains Mono', fill: '#f59e0b' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Right 4 Cols: F1 Score vs. False Positive Rate Trade-Off */}
            <section className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  F1 Score vs. False Alarm (FPR)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Higher F1 (cyan bar) with lower False Positive Rate (rose line) indicates superior detection
                </p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 16, left: 0, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.22} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    />
                    <YAxis
                      domain={[0, 105]}
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      unit="%"
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
                      formatter={(val) => [`${Number(val ?? 0).toFixed(2)}%`]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                    <Bar dataKey="F1 Score" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={28}>
                      <LabelList
                        dataKey="F1 Score"
                        position="top"
                        formatter={(v) => `${Number(v ?? 0).toFixed(1)}%`}
                        style={{ fontSize: '10px', fontFamily: 'JetBrains Mono', fill: '#06b6d4' }}
                      />
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="FPR"
                      name="False Positive Rate (%)"
                      stroke="#f43f5e"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#f43f5e' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
