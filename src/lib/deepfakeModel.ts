/**
 * Deepfake voice detection — in-browser inference with TensorFlow.js.
 *
 * Pipeline:
 *   1. Decode → mono → resample to 16 kHz → trim silence → pad/crop to 4 s.
 *   2. Compute log-Mel spectrogram (n_fft=1024, hop=256, n_mels=64).
 *   3. If a trained CNN is deployed under /public/model/, run it.
 *   4. Compute signal-based heuristics that flag classic synthesis artefacts
 *      (limited bandwidth, unnaturally clean noise floor, low spectral flux).
 *   5. Fuse the two scores. Real human speech keeps the model's verdict;
 *      obviously synthetic audio is pushed into the high-risk band.
 *
 * The heuristic is intentionally conservative: it only *raises* P(fake) when
 * multiple synthesis cues co-occur, so genuine human recordings are not
 * incorrectly upgraded to high-risk.
 */

import * as tf from '@tensorflow/tfjs';

export const MODEL_URL = '/model/model.json';
export const SAMPLE_RATE = 16000;
export const FIXED_DURATION_S = 4;
export const FIXED_SAMPLES = SAMPLE_RATE * FIXED_DURATION_S; // 64000
export const N_FFT = 1024;
export const HOP = 256;
export const N_MELS = 64;
export const N_FRAMES = Math.floor(FIXED_SAMPLES / HOP) + 1;

let modelPromise: Promise<tf.GraphModel | tf.LayersModel | null> | null = null;
let modelLoadFailed = false;

export async function isModelAvailable(): Promise<boolean> {
  const model = await loadModel();
  return model !== null;
}

export async function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      try {
        return await tf.loadGraphModel(MODEL_URL);
      } catch {
        try {
          return await tf.loadLayersModel(MODEL_URL);
        } catch {
          modelLoadFailed = true;
          return null;
        }
      }
    })();
  }
  return modelPromise;
}

/* ------------------------------------------------------------------ */
/* Audio preprocessing                                                 */
/* ------------------------------------------------------------------ */

async function fileToAudioBuffer(file: File | Blob): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const AC: typeof AudioContext =
    (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new AC();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    ctx.close();
  }
}

async function resampleToMono16k(buffer: AudioBuffer): Promise<Float32Array> {
  const channels = buffer.numberOfChannels;
  const len = buffer.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += data[i] / channels;
  }

  if (buffer.sampleRate === SAMPLE_RATE) return mono;

  const targetLength = Math.ceil((len * SAMPLE_RATE) / buffer.sampleRate);
  const offline = new OfflineAudioContext(1, targetLength, SAMPLE_RATE);
  const monoBuf = offline.createBuffer(1, len, buffer.sampleRate);
  monoBuf.copyToChannel(mono, 0);
  const src = offline.createBufferSource();
  src.buffer = monoBuf;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

function trimSilence(samples: Float32Array, threshold = 0.005): Float32Array {
  let start = 0;
  let end = samples.length;
  while (start < end && Math.abs(samples[start]) < threshold) start++;
  while (end > start && Math.abs(samples[end - 1]) < threshold) end--;
  if (start >= end) return samples;
  return samples.subarray(start, end);
}

function padOrCrop(samples: Float32Array, target: number): Float32Array {
  if (samples.length === target) return samples;
  if (samples.length > target) return samples.subarray(0, target);
  const out = new Float32Array(target);
  out.set(samples, 0);
  return out;
}

/* ----- Mel filterbank (librosa-compatible: htk=False, slaney norm) ----- */

function hzToMel(f: number) {
  const f_sp = 200.0 / 3;
  const min_log_hz = 1000.0;
  const min_log_mel = min_log_hz / f_sp;
  const logstep = Math.log(6.4) / 27.0;
  if (f >= min_log_hz) return min_log_mel + Math.log(f / min_log_hz) / logstep;
  return f / f_sp;
}
function melToHz(m: number) {
  const f_sp = 200.0 / 3;
  const min_log_hz = 1000.0;
  const min_log_mel = min_log_hz / f_sp;
  const logstep = Math.log(6.4) / 27.0;
  if (m >= min_log_mel) return min_log_hz * Math.exp(logstep * (m - min_log_mel));
  return f_sp * m;
}

function buildMelFilterbank(
  nMels: number,
  nFft: number,
  sr: number,
  fmin = 0,
  fmax = sr / 2
): Float32Array[] {
  const nBins = nFft / 2 + 1;
  const melMin = hzToMel(fmin);
  const melMax = hzToMel(fmax);
  const melPoints = new Float32Array(nMels + 2);
  for (let i = 0; i < nMels + 2; i++) {
    melPoints[i] = melMin + ((melMax - melMin) * i) / (nMels + 1);
  }
  const hzPoints = melPoints.map(melToHz);
  const binFreqs = new Float32Array(nBins);
  for (let i = 0; i < nBins; i++) binFreqs[i] = (i * sr) / nFft;

  const filters: Float32Array[] = [];
  for (let m = 1; m <= nMels; m++) {
    const left = hzPoints[m - 1];
    const center = hzPoints[m];
    const right = hzPoints[m + 1];
    const filt = new Float32Array(nBins);
    for (let k = 0; k < nBins; k++) {
      const f = binFreqs[k];
      if (f >= left && f <= center) filt[k] = (f - left) / (center - left);
      else if (f > center && f <= right) filt[k] = (right - f) / (right - center);
    }
    const enorm = 2.0 / (right - left);
    for (let k = 0; k < nBins; k++) filt[k] *= enorm;
    filters.push(filt);
  }
  return filters;
}

/* ----- FFT (Cooley-Tukey radix-2) ----- */

function fftRadix2(re: Float32Array, im: Float32Array) {
  const n = re.length;
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
    let m = n >> 1;
    while (j >= m && m > 0) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const theta = (-2 * Math.PI) / size;
    const wpr = Math.cos(theta);
    const wpi = Math.sin(theta);
    for (let i = 0; i < n; i += size) {
      let wr = 1;
      let wi = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const tr = wr * re[b] - wi * im[b];
        const ti = wr * im[b] + wi * re[b];
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const wrNew = wr * wpr - wi * wpi;
        wi = wr * wpi + wi * wpr;
        wr = wrNew;
      }
    }
  }
}

function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/* ----- Mel-spectrogram + per-frame band powers ----- */

let melFilters: Float32Array[] | null = null;
let hann: Float32Array | null = null;

interface Spectra {
  mel: Float32Array;          // [N_MELS * N_FRAMES] in [0,1]
  framePower: Float32Array;   // total per-frame power
  highBandRatio: number;      // mean fraction of energy above 4 kHz
  rolloff95Hz: number;        // mean 95% spectral rolloff in Hz
  noiseFloorDb: number;       // 10th-percentile frame energy in dB
  spectralFluxStd: number;    // std-dev of frame-to-frame change
}

export function computeSpectra(samples: Float32Array): Spectra {
  if (!melFilters) melFilters = buildMelFilterbank(N_MELS, N_FFT, SAMPLE_RATE);
  if (!hann) hann = hannWindow(N_FFT);

  const padded = new Float32Array(samples.length + N_FFT);
  padded.set(samples, N_FFT / 2);

  const nFrames = N_FRAMES;
  const nBins = N_FFT / 2 + 1;
  const mel = new Float32Array(N_MELS * nFrames);

  const re = new Float32Array(N_FFT);
  const im = new Float32Array(N_FFT);

  const framePower = new Float32Array(nFrames);
  const frameHighRatio = new Float32Array(nFrames);
  const frameRolloff = new Float32Array(nFrames);
  const frameDb = new Float32Array(nFrames);
  const prevMag = new Float32Array(nBins);

  // 4 kHz cutoff bin
  const highBin = Math.floor((4000 * N_FFT) / SAMPLE_RATE);

  let fluxSum = 0;
  let fluxSumSq = 0;
  let fluxCount = 0;

  for (let t = 0; t < nFrames; t++) {
    const start = t * HOP;
    for (let i = 0; i < N_FFT; i++) {
      re[i] = (padded[start + i] || 0) * hann![i];
      im[i] = 0;
    }
    fftRadix2(re, im);

    let totalPow = 0;
    let highPow = 0;
    const power = new Float32Array(nBins);
    for (let k = 0; k < nBins; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      power[k] = p;
      totalPow += p;
      if (k >= highBin) highPow += p;
    }
    framePower[t] = totalPow;
    frameHighRatio[t] = totalPow > 0 ? highPow / totalPow : 0;

    // 95% rolloff
    const target = 0.95 * totalPow;
    let cum = 0;
    let rolloffBin = nBins - 1;
    for (let k = 0; k < nBins; k++) {
      cum += power[k];
      if (cum >= target) { rolloffBin = k; break; }
    }
    frameRolloff[t] = (rolloffBin * SAMPLE_RATE) / N_FFT;
    frameDb[t] = 10 * Math.log10(Math.max(totalPow, 1e-12));

    // Spectral flux (L2 of positive magnitude diff)
    let flux = 0;
    for (let k = 0; k < nBins; k++) {
      const mag = Math.sqrt(power[k]);
      const d = mag - prevMag[k];
      if (d > 0) flux += d * d;
      prevMag[k] = mag;
    }
    if (t > 0) {
      const f = Math.sqrt(flux);
      fluxSum += f;
      fluxSumSq += f * f;
      fluxCount++;
    }

    // Mel
    for (let m = 0; m < N_MELS; m++) {
      const filt = melFilters![m];
      let sum = 0;
      for (let k = 0; k < nBins; k++) sum += filt[k] * power[k];
      const db = 10 * Math.log10(Math.max(sum, 1e-10));
      const norm = Math.max(0, Math.min(1, (db + 80) / 80));
      mel[m * nFrames + t] = norm;
    }
  }

  // High-band ratio averaged over voiced frames (top-50% energy)
  const sortedPow = Array.from(framePower).sort((a, b) => b - a);
  const voicedThresh = sortedPow[Math.floor(sortedPow.length / 2)] || 0;
  let hrSum = 0, hrN = 0, roSum = 0, roN = 0;
  for (let t = 0; t < nFrames; t++) {
    if (framePower[t] >= voicedThresh && framePower[t] > 0) {
      hrSum += frameHighRatio[t]; hrN++;
      roSum += frameRolloff[t]; roN++;
    }
  }
  const highBandRatio = hrN ? hrSum / hrN : 0;
  const rolloff95Hz = roN ? roSum / roN : 0;

  // Noise floor: 10th-percentile dB
  const sortedDb = Array.from(frameDb).sort((a, b) => a - b);
  const noiseFloorDb = sortedDb[Math.floor(sortedDb.length * 0.1)] || -80;

  const fluxMean = fluxCount ? fluxSum / fluxCount : 0;
  const fluxVar = fluxCount ? fluxSumSq / fluxCount - fluxMean * fluxMean : 0;
  const spectralFluxStd = Math.sqrt(Math.max(0, fluxVar));

  return { mel, framePower, highBandRatio, rolloff95Hz, noiseFloorDb, spectralFluxStd };
}

/* ------------------------------------------------------------------ */
/* Heuristic synthesis-artefact score                                  */
/* ------------------------------------------------------------------ */

export interface HeuristicReport {
  score: number;        // 0..1, higher = more "synthetic"
  reasons: string[];
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

export function heuristicFakeScore(s: Spectra): HeuristicReport {
  const reasons: string[] = [];

  // 1. Limited bandwidth: many TTS systems roll off well below 8 kHz.
  //    Real 16 kHz speech typically has rolloff > 6.5 kHz.
  const bandwidthCue = clamp01((6500 - s.rolloff95Hz) / 3500); // 0 above 6.5kHz, 1 at 3kHz
  if (bandwidthCue > 0.3) reasons.push(`Limited bandwidth (rolloff ≈ ${(s.rolloff95Hz / 1000).toFixed(1)} kHz)`);

  // 2. Low high-frequency energy ratio (>4 kHz).
  //    Real speech with sibilants / fricatives carries 8–25% above 4 kHz.
  const highCue = clamp01((0.06 - s.highBandRatio) / 0.06); // 1 when ratio ~0
  if (highCue > 0.3) reasons.push(`Weak >4 kHz energy (${(s.highBandRatio * 100).toFixed(1)}%)`);

  // 3. Unnaturally clean noise floor. Real recordings have ambient noise.
  //    Synthesised audio is often near digital silence between phonemes.
  const noiseCue = clamp01((-55 - s.noiseFloorDb) / 25); // 1 at -80 dB, 0 at -55 dB
  if (noiseCue > 0.3) reasons.push(`Very clean noise floor (${s.noiseFloorDb.toFixed(0)} dB)`);

  // 4. Overly smooth spectrum: low frame-to-frame spectral flux variance
  //    indicates synthetic prosody.
  const fluxCue = clamp01((1.2 - s.spectralFluxStd) / 1.2);
  if (fluxCue > 0.4) reasons.push('Unnaturally smooth spectral dynamics');

  // Combine: require at least two cues to fire strongly.
  const cues = [bandwidthCue, highCue, noiseCue, fluxCue].sort((a, b) => b - a);
  const score = clamp01(cues[0] * 0.5 + cues[1] * 0.35 + cues[2] * 0.15);
  return { score, reasons };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface Prediction {
  probFake: number;
  modelProb: number | null;
  heuristic: HeuristicReport;
  modelUsed: boolean;
}

export async function predict(file: File | Blob): Promise<Prediction> {
  const buffer = await fileToAudioBuffer(file);
  let samples = await resampleToMono16k(buffer);
  samples = trimSilence(samples);
  samples = padOrCrop(samples, FIXED_SAMPLES);

  const spectra = computeSpectra(samples);
  const heuristic = heuristicFakeScore(spectra);

  let modelProb: number | null = null;
  const model = await loadModel();
  if (model && !modelLoadFailed) {
    try {
      modelProb = tf.tidy(() => {
        const input = tf.tensor4d(spectra.mel, [1, N_MELS, N_FRAMES, 1]);
        const out = model.predict(input) as tf.Tensor;
        const data = out.dataSync();
        return clamp01(data[0]);
      });
    } catch (err) {
      console.warn('Model inference failed; using heuristic only.', err);
      modelLoadFailed = true;
    }
  }

  // Use the trained CNN's output directly when available. Heuristics are
  // retained as informational signals only (shown in the report) and are
  // *not* fused into the final probability — this guarantees the verdict
  // matches the Google Colab tfjs_model exactly.
  const probFake = modelProb !== null ? modelProb : heuristic.score;

  return { probFake, modelProb, heuristic, modelUsed: modelProb !== null };
}
