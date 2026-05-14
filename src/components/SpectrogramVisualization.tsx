import { useEffect, useRef, useState } from 'react';

interface SpectrogramVisualizationProps {
  audioFile: File | null;
}

// In-place iterative Cooley-Tukey radix-2 FFT
function fft(real: Float32Array, imag: Float32Array) {
  const n = real.length;
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angleStep = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < halfLen; k++) {
        const angle = angleStep * k;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const xr = real[i + k + halfLen] * wr - imag[i + k + halfLen] * wi;
        const xi = real[i + k + halfLen] * wi + imag[i + k + halfLen] * wr;
        real[i + k + halfLen] = real[i + k] - xr;
        imag[i + k + halfLen] = imag[i + k] - xi;
        real[i + k] += xr;
        imag[i + k] += xi;
      }
    }
  }
}

// Viridis-like colormap: dark purple -> blue -> teal -> green -> yellow
// intensity: 0..1 (0 = quietest / -100 dB, 1 = loudest / 0 dB)
function viridis(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  // 6 anchor stops approximating viridis
  const stops: [number, number, number][] = [
    [13, 8, 50],       // 0.0  deep purple
    [68, 1, 122],      // 0.2  purple
    [59, 82, 139],     // 0.4  blue
    [33, 145, 140],    // 0.6  teal
    [94, 201, 98],     // 0.8  green
    [253, 231, 37],    // 1.0  yellow
  ];
  const scaled = t * (stops.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  if (i >= stops.length - 1) return stops[stops.length - 1];
  const a = stops[i];
  const b = stops[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

interface PlotMeta {
  duration: number;
  sampleRate: number;
  maxFreq: number; // Hz at top of plot
}

export const SpectrogramVisualization = ({ audioFile }: SpectrogramVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const legendRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<PlotMeta | null>(null);

  // Render the dB color scale legend (always visible)
  useEffect(() => {
    const c = legendRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = 24;
    const h = 256;
    c.width = w;
    c.height = h;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      // top = 0 dB (loud, t=1), bottom = -100 dB (quiet, t=0)
      const t = 1 - y / (h - 1);
      const [r, g, b] = viridis(t);
      for (let x = 0; x < w; x++) {
        const pi = (y * w + x) * 4;
        img.data[pi] = r;
        img.data[pi + 1] = g;
        img.data[pi + 2] = b;
        img.data[pi + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  useEffect(() => {
    if (!audioFile || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setMeta(null);

    const generateSpectrogram = async () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioCtx();
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        audioContext.close();

        if (cancelled) return;

        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const mono = new Float32Array(length);
        for (let c = 0; c < numChannels; c++) {
          const data = audioBuffer.getChannelData(c);
          for (let i = 0; i < length; i++) mono[i] += data[i] / numChannels;
        }

        const fftSize = 1024;
        const hopSize = 256;
        const numBins = fftSize / 2;
        const numFrames = Math.max(1, Math.floor((mono.length - fftSize) / hopSize));
        const nyquist = sampleRate / 2;

        const hann = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
          hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
        }

        const width = Math.min(numFrames, 1000);
        const height = 256;
        canvas.width = width;
        canvas.height = height;

        const magnitudes: Float32Array[] = new Array(width);
        const real = new Float32Array(fftSize);
        const imag = new Float32Array(fftSize);

        let globalMax = -Infinity;

        for (let x = 0; x < width; x++) {
          const frameIdx = Math.floor((x / width) * numFrames);
          const start = frameIdx * hopSize;
          for (let i = 0; i < fftSize; i++) {
            real[i] = mono[start + i] * hann[i];
            imag[i] = 0;
          }
          fft(real, imag);

          const mags = new Float32Array(numBins);
          for (let k = 0; k < numBins; k++) {
            const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
            const dB = 20 * Math.log10(mag + 1e-10);
            mags[k] = dB;
            if (dB > globalMax) globalMax = dB;
          }
          magnitudes[x] = mags;

          if (x % 100 === 0) await new Promise((r) => setTimeout(r, 0));
          if (cancelled) return;
        }

        // Normalize so loudest = 0 dB, floor at -100 dB
        const maxV = 0; // top of scale
        const minV = -100; // bottom of scale
        const offset = -globalMax; // shift so max maps to 0 dB

        // Log-frequency mapping (mel-like). Show from ~50 Hz up to nyquist.
        const minFreq = 50;
        const maxFreq = nyquist;
        const minLog = Math.log10(minFreq);
        const maxLog = Math.log10(maxFreq);

        const imageData = ctx.createImageData(width, height);

        for (let x = 0; x < width; x++) {
          const mags = magnitudes[x];
          for (let y = 0; y < height; y++) {
            const t = (height - 1 - y) / (height - 1); // 0 bottom, 1 top
            const freq = Math.pow(10, minLog + t * (maxLog - minLog));
            const bin = Math.min(numBins - 1, Math.max(0, Math.round((freq / nyquist) * (numBins - 1))));
            const dB = mags[bin] + offset; // normalized so 0 dB = peak
            const v = (dB - minV) / (maxV - minV); // 0..1
            const intensity = Math.max(0, Math.min(1, v));

            const [r, g, b] = viridis(intensity);
            const pi = (y * width + x) * 4;
            imageData.data[pi] = r;
            imageData.data[pi + 1] = g;
            imageData.data[pi + 2] = b;
            imageData.data[pi + 3] = 255;
          }
        }

        if (cancelled) return;
        ctx.putImageData(imageData, 0, 0);
        setMeta({ duration, sampleRate, maxFreq });
        setIsLoading(false);
      } catch (err) {
        console.error('Error generating spectrogram:', err);
        if (!cancelled) {
          setError('Could not generate spectrogram from this audio.');
          setIsLoading(false);
        }
      }
    };

    generateSpectrogram();

    return () => {
      cancelled = true;
    };
  }, [audioFile]);

  // Build frequency tick labels (log-spaced, human-friendly)
  const freqTicks = (() => {
    if (!meta) return [];
    const candidates = [50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const minFreq = 50;
    const maxFreq = meta.maxFreq;
    const minLog = Math.log10(minFreq);
    const maxLog = Math.log10(maxFreq);
    return candidates
      .filter((f) => f >= minFreq && f <= maxFreq)
      .map((f) => {
        const t = (Math.log10(f) - minLog) / (maxLog - minLog); // 0 bottom, 1 top
        const topPct = (1 - t) * 100; // CSS top
        const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
        return { label, topPct };
      });
  })();

  // Build time tick labels (5 evenly spaced)
  const timeTicks = (() => {
    if (!meta) return [];
    const n = 5;
    const ticks = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * meta.duration;
      ticks.push({ leftPct: (i / n) * 100, label: t.toFixed(2) });
    }
    return ticks;
  })();

  const dBTicks = [0, -20, -40, -60, -80, -100];

  return (
    <div className="w-full">
      <div className="flex gap-2">
        {/* Frequency axis label (rotated, separate column) */}
        <div className="flex items-center justify-center w-4 shrink-0 h-64">
          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap -rotate-90">
            Frequency (Hz)
          </span>
        </div>

        {/* Frequency tick numbers */}
        <div className="relative w-10 shrink-0 h-64">
          <div className="absolute inset-y-0 right-0 w-px bg-border/50" />
          {freqTicks.map((t, i) => (
            <div
              key={i}
              className="absolute right-1 -translate-y-1/2 text-[10px] font-mono text-muted-foreground whitespace-nowrap"
              style={{ top: `${t.topPct}%` }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* Spectrogram + time axis */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="w-full h-64 rounded-lg bg-card border border-border/50 block"
              style={{ imageRendering: 'auto' }}
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-30 rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-xs text-muted-foreground font-mono">Computing FFT…</p>
                </div>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-30 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
          {/* Time ticks */}
          <div className="relative h-4 mt-1">
            {timeTicks.map((t, i) => (
              <div
                key={i}
                className="absolute -translate-x-1/2 text-[10px] font-mono text-muted-foreground"
                style={{ left: `${t.leftPct}%` }}
              >
                {t.label}
              </div>
            ))}
          </div>
          <div className="text-center text-[10px] font-mono text-muted-foreground mt-1">
            Time (s)
          </div>
        </div>

        {/* dB color bar */}
        <div className="shrink-0 h-64">
          <canvas
            ref={legendRef}
            className="h-64 w-6 rounded border border-border/50 block"
          />
        </div>

        {/* dB tick numbers */}
        <div className="relative w-12 shrink-0 h-64">
          {dBTicks.map((db, i) => {
            const topPct = (Math.abs(db) / 100) * 100;
            return (
              <div
                key={i}
                className="absolute left-1 -translate-y-1/2 text-[10px] font-mono text-muted-foreground whitespace-nowrap"
                style={{ top: `${topPct}%` }}
              >
                {db} dB
              </div>
            );
          })}
        </div>

        {/* Power axis label (rotated, separate column) */}
        <div className="flex items-center justify-center w-4 shrink-0 h-64">
          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap -rotate-90">
            Power (dB)
          </span>
        </div>
      </div>

      {/* dB color category legend */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] font-mono">
        {[
          { range: '0 to -20 dB', label: 'Very Loud', color: 'rgb(253,231,37)' },
          { range: '-20 to -40 dB', label: 'Loud', color: 'rgb(94,201,98)' },
          { range: '-40 to -60 dB', label: 'Moderate', color: 'rgb(33,145,140)' },
          { range: '-60 to -80 dB', label: 'Quiet', color: 'rgb(59,82,139)' },
          { range: '-80 to -100 dB', label: 'Silent', color: 'rgb(40,8,90)' },
        ].map((c, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1 rounded border border-border/50 bg-card/50">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: c.color }} />
            <div className="min-w-0">
              <div className="text-foreground truncate">{c.label}</div>
              <div className="text-muted-foreground truncate">{c.range}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
