import React, { useEffect, useRef, useState } from 'react';
import { Download, Eye, Grid } from 'lucide-react';
import { TimeFrequencyHeatmap } from '../types/ldos';

export type ScientificColormap = 'paper' | 'viridis' | 'plasma';

interface TimeFrequencyCanvasProps {
  heatmap: TimeFrequencyHeatmap;
  subtitle?: string;
  defaultColormap?: ScientificColormap;
}

// High-precision scientific colormaps (Paper Parula/Jet, Viridis, Plasma)
function getScientificColor(
  t: number,
  scheme: ScientificColormap = 'paper'
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));

  const stopsMap: Record<ScientificColormap, number[][]> = {
    // Paper-authentic MATLAB/Matplotlib Parula-Jet hybrid matching Wang et al. (2024) Fig. 3
    paper: [
      [10, 22, 78],     // 0.00: Deep midnight navy
      [20, 68, 164],    // 0.20: Royal cobalt blue
      [12, 148, 208],   // 0.40: Bright scientific cyan
      [46, 204, 138],   // 0.60: Emerald seafoam
      [244, 198, 48],   // 0.80: Warm amber gold
      [254, 250, 110],  // 1.00: Peak energy bright yellow
    ],
    viridis: [
      [68, 1, 84],
      [59, 82, 139],
      [33, 145, 140],
      [94, 201, 98],
      [253, 231, 37],
    ],
    plasma: [
      [13, 8, 135],
      [126, 3, 168],
      [204, 71, 120],
      [248, 149, 64],
      [240, 249, 33],
    ],
  };

  const stops = stopsMap[scheme] || stopsMap.paper;
  const scaled = clamped * (stops.length - 1);
  const idx = Math.min(stops.length - 2, Math.floor(scaled));
  const frac = scaled - idx;
  const c0 = stops[idx];
  const c1 = stops[idx + 1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * frac),
    Math.round(c0[1] + (c1[1] - c0[1]) * frac),
    Math.round(c0[2] + (c1[2] - c0[2]) * frac),
  ];
}

// Bilinear interpolation helper on matrix[t][f]
function sampleMatrixBilinear(matrix: number[][], u: number, v: number): number {
  const nTime = matrix.length;
  const nFreq = matrix[0]?.length || 1;
  const tx = Math.max(0, Math.min(nTime - 1, u * (nTime - 1)));
  const fy = Math.max(0, Math.min(nFreq - 1, v * (nFreq - 1)));

  const t0 = Math.floor(tx);
  const t1 = Math.min(nTime - 1, t0 + 1);
  const dt = tx - t0;

  const f0 = Math.floor(fy);
  const f1 = Math.min(nFreq - 1, f0 + 1);
  const df = fy - f0;

  const v00 = matrix[t0][f0] ?? 0;
  const v10 = matrix[t1][f0] ?? 0;
  const v01 = matrix[t0][f1] ?? 0;
  const v11 = matrix[t1][f1] ?? 0;

  const top = v00 * (1 - dt) + v10 * dt;
  const bottom = v01 * (1 - dt) + v11 * dt;
  return top * (1 - df) + bottom * df;
}

export const TimeFrequencyCanvas: React.FC<TimeFrequencyCanvasProps> = ({
  heatmap,
  subtitle,
  defaultColormap = 'paper',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [colormap, setColormap] = useState<ScientificColormap>(defaultColormap);
  const [smoothMode, setSmoothMode] = useState<boolean>(true);
  const [hoverInfo, setHoverInfo] = useState<{
    canvasX: number;
    canvasY: number;
    time: number;
    freq: number;
    amplitude: number;
    band: string;
  } | null>(null);

  const { matrix, times, frequencies, lowFreqCutoffHz, title, label } = heatmap;

  // Compute max amplitude and low-frequency energy percentage for the header badge
  let maxVal = 1e-6;
  let totalEnergy = 0;
  let lowBandEnergy = 0;
  const nTime = matrix.length;
  const nFreq = matrix[0]?.length || 1;
  const lowBandBins = Math.max(1, Math.floor(nFreq / 5));

  for (let i = 0; i < nTime; i++) {
    for (let j = 0; j < nFreq; j++) {
      const val = matrix[i][j] || 0;
      if (val > maxVal) maxVal = val;
      const sq = val * val;
      totalEnergy += sq;
      if (j < lowBandBins) lowBandEnergy += sq;
    }
  }
  const lowFreqEnergyPct = totalEnergy > 0 ? (lowBandEnergy / totalEnergy) * 100 : 0;

  // Logical coordinate system dimensions
  const LOGICAL_W = 760;
  const LOGICAL_H = 380;
  const PAD_LEFT = 64;
  const PAD_RIGHT = 82; // Space for calibrated vertical colorbar
  const PAD_TOP = 24;
  const PAD_BOTTOM = 48;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !matrix.length || !matrix[0]?.length) return;

    const dpr = typeof window !== 'undefined' ? Math.min(2.5, window.devicePixelRatio || 1) : 1;
    canvas.width = Math.round(LOGICAL_W * dpr);
    canvas.height = Math.round(LOGICAL_H * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);

    const plotW = LOGICAL_W - PAD_LEFT - PAD_RIGHT;
    const plotH = LOGICAL_H - PAD_TOP - PAD_BOTTOM;

    // Background fill for crisp export
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // 1. Render 2D Time-Frequency Distribution Matrix
    if (smoothMode) {
      // High-resolution bilinear-interpolated pixel buffer for smooth continuous contours
      const offscreen = document.createElement('canvas');
      const bufW = Math.round(plotW);
      const bufH = Math.round(plotH);
      offscreen.width = bufW;
      offscreen.height = bufH;
      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        const imgData = offCtx.createImageData(bufW, bufH);
        const data = imgData.data;
        for (let py = 0; py < bufH; py++) {
          const v = 1 - py / Math.max(1, bufH - 1); // 0 at bottom (low freq), 1 at top (high freq)
          for (let px = 0; px < bufW; px++) {
            const u = px / Math.max(1, bufW - 1);
            const rawVal = sampleMatrixBilinear(matrix, u, v);
            const norm = Math.pow(Math.max(0, rawVal) / maxVal, 0.75);
            const [r, g, b] = getScientificColor(norm, colormap);
            const idx = (py * bufW + px) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
          }
        }
        offCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(offscreen, PAD_LEFT, PAD_TOP, plotW, plotH);
      }
    } else {
      // Discrete matrix cells
      const cellW = plotW / nTime;
      const cellH = plotH / nFreq;
      for (let tIdx = 0; tIdx < nTime; tIdx++) {
        for (let fIdx = 0; fIdx < nFreq; fIdx++) {
          const val = matrix[tIdx][fIdx];
          const norm = Math.pow(Math.max(0, val) / maxVal, 0.75);
          const [r, g, b] = getScientificColor(norm, colormap);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          const x = PAD_LEFT + tIdx * cellW;
          const y = PAD_TOP + plotH - (fIdx + 1) * cellH;
          ctx.fillRect(x, y, Math.ceil(cellW) + 0.5, Math.ceil(cellH) + 0.5);
        }
      }
    }

    // 2. Subtle scientific reference grid over heatmap
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 0.75;
    ctx.setLineDash([2, 3]);
    for (let i = 1; i < 5; i++) {
      const gx = PAD_LEFT + (i / 5) * plotW;
      ctx.beginPath();
      ctx.moveTo(gx, PAD_TOP);
      ctx.lineTo(gx, PAD_TOP + plotH);
      ctx.stroke();
    }
    for (let j = 1; j < 5; j++) {
      const gy = PAD_TOP + (j / 5) * plotH;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, gy);
      ctx.lineTo(PAD_LEFT + plotW, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. Low-Frequency Observation Band (First 1/5 of Nyquist frequency, Wang et al. Section 4.2.2)
    const lowFreqBoundaryY = PAD_TOP + plotH * (1 - 0.2);
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, lowFreqBoundaryY);
    ctx.lineTo(PAD_LEFT + plotW, lowFreqBoundaryY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Translucent pill label for Low-Frequency Band cutoff
    const badgeText = `Low-Freq Band Cutoff (0 – ${lowFreqCutoffHz.toFixed(1)} Hz = 1/5 fs)`;
    ctx.font = '600 10.5px "JetBrains Mono", monospace';
    const textW = ctx.measureText(badgeText).width;
    ctx.fillStyle = 'rgba(9, 13, 22, 0.82)';
    ctx.fillRect(PAD_LEFT + 8, lowFreqBoundaryY - 19, textW + 12, 16);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(PAD_LEFT + 8, lowFreqBoundaryY - 19, textW + 12, 16);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.fillText(badgeText, PAD_LEFT + 14, lowFreqBoundaryY - 7);
    ctx.restore();

    // 4. Hover Crosshair Overlay
    if (hoverInfo) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverInfo.canvasX, PAD_TOP);
      ctx.lineTo(hoverInfo.canvasX, PAD_TOP + plotH);
      ctx.moveTo(PAD_LEFT, hoverInfo.canvasY);
      ctx.lineTo(PAD_LEFT + plotW, hoverInfo.canvasY);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hoverInfo.canvasX, hoverInfo.canvasY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 5. Plot Frame Border
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(PAD_LEFT, PAD_TOP, plotW, plotH);

    // 6. X-Axis (Time in Seconds) Ticks & Title
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    const timeTicks = 5;
    const tStart = times.length > 0 ? times[0] : 0;
    const tEnd = times.length > 0 ? times[times.length - 1] : 10;
    for (let i = 0; i <= timeTicks; i++) {
      const frac = i / timeTicks;
      const x = PAD_LEFT + frac * plotW;
      const tVal = tStart + frac * (tEnd - tStart);

      ctx.strokeStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(x, PAD_TOP + plotH);
      ctx.lineTo(x, PAD_TOP + plotH + 5);
      ctx.stroke();

      ctx.fillText(`${tVal.toFixed(1)}s`, x, PAD_TOP + plotH + 18);
    }

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 11.5px "Inter", sans-serif';
    ctx.fillText('Time (Seconds)', PAD_LEFT + plotW / 2, LOGICAL_H - 8);

    // 7. Y-Axis (Frequency in Hz) Ticks & Rotated Title
    ctx.textAlign = 'right';
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#cbd5e1';
    const freqTicks = 5;
    const maxFreq = frequencies[frequencies.length - 1] || 5.0;
    for (let j = 0; j <= freqTicks; j++) {
      const frac = j / freqTicks;
      const y = PAD_TOP + plotH - frac * plotH;
      const fVal = frac * maxFreq;

      ctx.strokeStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT - 5, y);
      ctx.lineTo(PAD_LEFT, y);
      ctx.stroke();

      ctx.fillText(`${fVal.toFixed(1)}`, PAD_LEFT - 8, y + 3.5);
    }

    ctx.save();
    ctx.translate(16, PAD_TOP + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 11.5px "Inter", sans-serif';
    ctx.fillText('Frequency (Hz)', 0, 0);
    ctx.restore();

    // 8. Calibrated Vertical Colorbar on Right Side
    const cbX = PAD_LEFT + plotW + 16;
    const cbW = 14;
    const cbH = plotH;
    for (let py = 0; py < cbH; py++) {
      const norm = 1 - py / Math.max(1, cbH - 1);
      const [r, g, b] = getScientificColor(norm, colormap);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(cbX, PAD_TOP + py, cbW, 1.5);
    }
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(cbX, PAD_TOP, cbW, cbH);

    ctx.textAlign = 'left';
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#cbd5e1';
    const cbTicks = 4;
    for (let k = 0; k <= cbTicks; k++) {
      const frac = k / cbTicks;
      const y = PAD_TOP + cbH - frac * cbH;
      const val = frac * maxVal;
      ctx.beginPath();
      ctx.moveTo(cbX + cbW, y);
      ctx.lineTo(cbX + cbW + 4, y);
      ctx.stroke();
      ctx.fillText(val.toFixed(2), cbX + cbW + 6, y + 3);
    }
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('|M_ij|', cbX, PAD_TOP - 7);

    ctx.restore();
  }, [
    heatmap,
    colormap,
    smoothMode,
    maxVal,
    matrix,
    times,
    frequencies,
    lowFreqCutoffHz,
    nTime,
    nFreq,
    hoverInfo,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !matrix.length || !matrix[0]?.length) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
    const cy = ((e.clientY - rect.top) / rect.height) * LOGICAL_H;

    const plotW = LOGICAL_W - PAD_LEFT - PAD_RIGHT;
    const plotH = LOGICAL_H - PAD_TOP - PAD_BOTTOM;

    if (cx < PAD_LEFT || cx > PAD_LEFT + plotW || cy < PAD_TOP || cy > PAD_TOP + plotH) {
      setHoverInfo(null);
      return;
    }

    const tIdx = Math.min(nTime - 1, Math.max(0, Math.floor(((cx - PAD_LEFT) / plotW) * nTime)));
    const fIdx = Math.min(
      nFreq - 1,
      Math.max(0, Math.floor(((PAD_TOP + plotH - cy) / plotH) * nFreq))
    );

    const freq = frequencies[fIdx] ?? 0;
    setHoverInfo({
      canvasX: cx,
      canvasY: cy,
      time: times[tIdx] ?? tIdx,
      freq,
      amplitude: matrix[tIdx][fIdx] ?? 0,
      band: fIdx < Math.max(1, Math.floor(nFreq / 5)) ? 'Low-Freq Band (1/5)' : 'Mid-High Band (4/5)',
    });
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `time_frequency_win${heatmap.windowIndex + 1}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h4>
            <span
              className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded ${
                label === 1
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
              }`}
            >
              {label === 1 ? 'LS = 1 (LDoS Attack)' : 'NS = 0 (Normal)'} · RE_low:{' '}
              {lowFreqEnergyPct.toFixed(1)}%
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Colormap selector */}
          <select
            value={colormap}
            onChange={(e) => setColormap(e.target.value as ScientificColormap)}
            aria-label="Select Colormap"
            className="px-2 py-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <option value="paper">Colormap: Paper (Parula)</option>
            <option value="viridis">Colormap: Viridis</option>
            <option value="plasma">Colormap: Plasma</option>
          </select>

          {/* Interpolation toggle */}
          <button
            type="button"
            onClick={() => setSmoothMode((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Toggle smooth bilinear interpolation vs discrete time-frequency cells"
          >
            {smoothMode ? <Eye className="w-3.5 h-3.5 text-cyan-500" /> : <Grid className="w-3.5 h-3.5" />}
            {smoothMode ? 'Smooth' : 'Grid'}
          </button>

          {/* High-DPI PNG Download */}
          <button
            type="button"
            onClick={handleDownloadPng}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            PNG
          </button>
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-950">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
          className="w-full h-auto block cursor-crosshair"
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 tabular-nums">
          <span>Low-Band Energy (0–{lowFreqCutoffHz}Hz):</span>
          <strong
            className={
              lowFreqEnergyPct > 45
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }
          >
            {lowFreqEnergyPct.toFixed(1)}% of total window energy
          </strong>
        </div>

        {hoverInfo ? (
          <div className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded tabular-nums">
            t = {hoverInfo.time.toFixed(2)}s · f = {hoverInfo.freq.toFixed(2)}Hz · |M_ij| ={' '}
            {hoverInfo.amplitude.toFixed(3)} · {hoverInfo.band}
          </div>
        ) : (
          <span>Hover time–frequency plane to inspect (t, f, |M_ij|) coordinates</span>
        )}
      </div>
    </div>
  );
};
