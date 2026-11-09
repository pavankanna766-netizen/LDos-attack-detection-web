import React, { useState } from 'react';
import {
  ArrowRight,
  Upload,
  Activity,
  Waves,
  Sliders,
  GitBranch,
  ShieldAlert,
  BookOpen,
  Code2,
  X,
} from 'lucide-react';

interface HomePageProps {
  onStartDetection: () => void;
  onQuickLoadBenchmark: (presetId: string) => void;
  isLoadingBenchmark: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({
  onStartDetection,
  onQuickLoadBenchmark,
  isLoadingBenchmark,
}) => {
  const [showPaperModal, setShowPaperModal] = useState(false);
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);

  const pipelineSteps = [
    {
      num: '01',
      title: 'Upload Dataset',
      desc: 'Single labelled CSV or dual Normal + LDoS traffic captures',
      icon: Upload,
    },
    {
      num: '02',
      title: 'Signal Processing',
      desc: 'Window segmentation (10 Hz, 100 samples) & DC bias removal',
      icon: Activity,
    },
    {
      num: '03',
      title: 'Time-Frequency Analysis',
      desc: 'FSWT frequency slicing, STFT spectrogram, or CWT scalogram',
      icon: Waves,
    },
    {
      num: '04',
      title: 'Feature Extraction',
      desc: 'Entropy, Low-Freq Energy Ratio, Contrast & Correlation',
      icon: Sliders,
    },
    {
      num: '05',
      title: 'Machine Learning',
      desc: 'Decision Tree (Baseline) or Random Forest classification',
      icon: GitBranch,
    },
    {
      num: '06',
      title: 'Detection Result',
      desc: 'Window predictions, confusion matrix, TPR/FPR & exports',
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 md:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="text-xs font-mono text-cyan-700 dark:text-cyan-400">
                Signals & Systems Academic Research Platform · Wang et al. (2024) Methodology
              </div>

              <h1
                className="text-3xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.15]"
                style={{ textWrap: 'balance' }}
              >
                LDoS Attack Detector
              </h1>

              <p className="text-lg sm:text-xl font-medium text-slate-700 dark:text-slate-200 leading-snug">
                Detect Low-Rate Denial-of-Service Attacks Using Signal Processing and Machine Learning
              </p>

              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                Low-Rate Denial-of-Service (LDoS) attacks use periodic short traffic bursts{' '}
                <span className="font-mono text-slate-800 dark:text-slate-200">(T, L, R)</span> with pulse
                duration <span className="font-mono">L &lt; T</span> to exploit TCP Retransmission Timeout
                (RTO) and AIMD congestion control mechanisms. Because their average traffic rate{' '}
                <span className="font-mono">R · (L / T)</span> remains small, LDoS flows stay hidden from
                traditional volume-based detectors—requiring joint time–frequency representation via the{' '}
                <strong className="font-semibold text-slate-900 dark:text-slate-100">
                  Frequency Slice Wavelet Transform (FSWT)
                </strong>
                .
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onStartDetection}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Start Detection
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={isLoadingBenchmark}
                onClick={() => onQuickLoadBenchmark('ns2_set1_T1_L02_R25')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {isLoadingBenchmark ? 'Loading Dataset...' : 'Load NS2 Benchmark & Configure'}
              </button>

              <button
                type="button"
                onClick={() => setShowPaperModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-4 h-4" />
                View Reference Paper PDF
              </button>

              <button
                type="button"
                onClick={() => setShowIntegrationModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Code2 className="w-4 h-4" />
                Python Integration Guide
              </button>
            </div>
          </div>

          {/* Right Panel: LDoS Pulse Model (T, L, R) & FSWT Mathematical Formulation */}
          <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 mb-2">
                <span>Fig. 1. LDoS Periodic Pulse Threat Model</span>
                <span>L &lt; T · Avg Rate = R·(L/T)</span>
              </div>

              {/* Clean SVG Waveform Schematic of LDoS Pulse Model (T, L, R) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3">
                <svg viewBox="0 0 420 135" className="w-full h-auto">
                  {/* Axes */}
                  <line x1="36" y1="15" x2="36" y2="108" stroke="#64748b" strokeWidth="1.5" />
                  <line x1="36" y1="108" x2="400" y2="108" stroke="#64748b" strokeWidth="1.5" />
                  <text x="10" y="24" className="fill-slate-500 text-[9px] font-mono">
                    Rate R
                  </text>
                  <text x="372" y="124" className="fill-slate-500 text-[9px] font-mono">
                    Time (s)
                  </text>

                  {/* Background normal TCP traffic wave */}
                  <path
                    d="M 36 86 Q 50 80 64 85 T 92 84 T 120 96 T 148 92 T 176 84 T 204 86 T 232 97 T 260 91 T 288 85 T 316 86 T 344 96 T 372 88"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />

                  {/* Periodic LDoS rectangular pulses */}
                  <path
                    d="M 36 108 L 75 108 L 75 28 L 105 28 L 105 108 L 195 108 L 195 28 L 225 28 L 225 108 L 315 108 L 315 28 L 345 28 L 345 108 L 390 108"
                    fill="rgba(239, 68, 68, 0.14)"
                    stroke="#ef4444"
                    strokeWidth="2"
                  />

                  {/* Annotations for L, T-L, T */}
                  <line x1="75" y1="18" x2="105" y2="18" stroke="#ef4444" strokeWidth="1.2" />
                  <text x="86" y="14" className="fill-red-500 text-[10px] font-mono font-bold">
                    L
                  </text>

                  <line x1="105" y1="18" x2="195" y2="18" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="138" y="14" className="fill-slate-500 text-[10px] font-mono">
                    T - L (Silent)
                  </text>

                  <line x1="75" y1="122" x2="195" y2="122" stroke="#0f172a" className="dark:stroke-slate-300" strokeWidth="1.2" />
                  <text x="128" y="132" className="fill-slate-700 dark:fill-slate-300 text-[10px] font-mono font-bold">
                    Period T
                  </text>
                </svg>
              </div>
            </div>

            {/* Key Mathematical Equations Box */}
            <div className="space-y-2 text-xs font-mono border-t border-slate-200 dark:border-slate-800 pt-3">
              <div className="text-slate-500 dark:text-slate-400 font-sans font-medium">
                Core FSWT Formulation & Paper Parameters
              </div>
              <div className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2">
                W(t, i) = λ · F⁻¹&#123; F&#123;X&#125; · P_i &#125;, &nbsp; p̂(ω) = e^(-0.5ω²)
              </div>
              <div className="text-slate-600 dark:text-slate-400 tabular-nums">
                λ = 1.0 · η = 0.05 · υ = 0.5 · κ = 23.5482 · Low-Freq Band = [0, fs/5]
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Scientific Pipeline Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Core Scientific Detection Pipeline
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              End-to-end signal processing and machine learning architecture from raw network traffic to
              window-level classification
            </p>
          </div>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Class Labels: Normal Traffic = 0 · LDoS Attack = 1
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {pipelineSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between relative"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 dark:text-slate-500 mb-3">
                    <span>STAGE {step.num}</span>
                    <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                {idx < pipelineSteps.length - 1 && (
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 flex items-center justify-end">
                    Next →
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Research Method vs Comparative Methods Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
          <div className="text-xs font-mono text-amber-600 dark:text-amber-400">
            ★ Research Paper Baseline (Wang et al., 2024)
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            FSWT Time-Frequency Distribution
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Unlike STFT (constrained by fixed window length) and CWT (sensitive to wavelet basis and
            scale length), FSWT uses a Gaussian Frequency Slice Function to isolate low-frequency
            periodic LDoS energy in the first 1/5 observation band.
          </p>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
            FSWT → 4 Features → Decision Tree Classifier
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
            Extracted Time-Frequency Features
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            4 Core Paper Features & 6 Extended Set
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            During an LDoS attack, energy concentrates in the low-frequency band: Entropy decreases,
            Low-Frequency Energy Ratio increases, Contrast increases (sharper visual stripes), and
            Row-Column Correlation increases.
          </p>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
            Entropy · Energy Ratio · Contrast · Correlation (+ Centroid, Kurtosis)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
          <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
            Empirical Evaluation & Comparative Benchmarks
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Zero-Mock Scientific Computation
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Every uploaded CSV dataset is segmented into windows, transformed into 2D time-frequency
            matrices, and classified via CART Decision Tree or Random Forest to compute genuine TP, TN,
            FP, FN, Accuracy, Precision, Recall, F1, and FPR.
          </p>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
            Default: fs = 10 Hz · Window = 100 samples (10s) · Test = 30%
          </div>
        </div>
      </section>

      {/* Reference Paper PDF Viewer Modal */}
      {showPaperModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-5xl w-full h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Reference Research Paper — Wang et al. (2024), Expert Systems With Applications
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  An LDoS attack detection method based on FSWT time–frequency distribution
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaperModal(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950">
              <iframe
                src="/assets/aistudio/1-s2.0-S0957417424018736-main_ae8f3699.pdf"
                title="Wang et al. 2024 Reference Paper"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Python Repository Integration Guide Modal */}
      {showIntegrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-3xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Integrating Your Existing Python LDoS Detection Repository
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Modular FastAPI architecture in /backend/services/
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIntegrationModal(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                The Python FastAPI backend in <code className="font-mono text-cyan-600 dark:text-cyan-400">backend/</code> is
                organized into clean, decoupled service modules with explicit{' '}
                <code className="font-mono">[INTEGRATION POINT]</code> docstrings so you can plug in your
                existing Python functions directly:
              </p>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden font-mono">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Module File</th>
                      <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Function Hook</th>
                      <th className="p-2.5 border-b border-slate-200 dark:border-slate-700 font-sans">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    <tr>
                      <td className="p-2.5">backend/services/dataset_loader.py</td>
                      <td className="p-2.5 text-cyan-600 dark:text-cyan-400">validate_dataset()</td>
                      <td className="p-2.5 font-sans">CSV schema validation & Mode B dual-file merging</td>
                    </tr>
                    <tr>
                      <td className="p-2.5">backend/services/preprocessing.py</td>
                      <td className="p-2.5 text-cyan-600 dark:text-cyan-400">preprocess_and_segment_signal()</td>
                      <td className="p-2.5 font-sans">DC bias removal & sliding window segmentation</td>
                    </tr>
                    <tr>
                      <td className="p-2.5">backend/services/transforms.py</td>
                      <td className="p-2.5 text-cyan-600 dark:text-cyan-400">compute_fswt(), compute_stft(), compute_cwt()</td>
                      <td className="p-2.5 font-sans">2D Time-Frequency distribution matrix M_ij</td>
                    </tr>
                    <tr>
                      <td className="p-2.5">backend/services/feature_extraction.py</td>
                      <td className="p-2.5 text-cyan-600 dark:text-cyan-400">extract_window_features()</td>
                      <td className="p-2.5 font-sans">Entropy, Energy Ratio, Contrast, Correlation (+2)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5">backend/services/ml_classifier.py</td>
                      <td className="p-2.5 text-cyan-600 dark:text-cyan-400">train_and_evaluate_classifier()</td>
                      <td className="p-2.5 font-sans">Decision Tree & Random Forest training + TPR/FPR</td>
                    </tr>
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
