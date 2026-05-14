/**
 * Light-weight client-side security checks for audio uploads.
 *
 * Scope: input validation, MIME/extension whitelisting, magic-byte sniffing,
 * size & duration caps, filename sanitisation. These are realistic
 * defence-in-depth measures for a static, fully client-side app — they
 * reduce attack surface (oversized files, mislabeled blobs, path-traversal
 * filenames) before the audio reaches the model pipeline.
 */

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_DURATION_SECONDS = 60;
export const MIN_FILE_SIZE_BYTES = 256; // reject empty/garbage blobs

const ALLOWED_EXTENSIONS = ['wav', 'mp3', 'mpeg', 'mpga', 'webm', 'ogg', 'm4a'];
const ALLOWED_MIME_PREFIX = 'audio/';

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/** Strip directory components and dangerous characters from a user-provided name. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^\w.\-() ]+/g, '_').slice(0, 120);
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

/** Inspect first bytes for known audio container signatures. */
async function sniffMagicBytes(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head.length < 4) return false;
  // RIFF....WAVE
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) return true;
  // ID3 (MP3 with tag)
  if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return true;
  // MP3 frame sync 0xFFEx
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return true;
  // OggS
  if (head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) return true;
  // EBML (WebM/Matroska) 0x1A45DFA3
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return true;
  // ftyp box (M4A/MP4) at offset 4
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return true;
  return false;
}

export async function validateAudioFile(file: File): Promise<ValidationResult> {
  if (!file) return { ok: false, reason: 'No file provided.' };

  if (file.size < MIN_FILE_SIZE_BYTES) {
    return { ok: false, reason: 'File is empty or too small to be valid audio.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      reason: `File exceeds the ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB limit.`,
    };
  }

  const ext = getExtension(file.name);
  const mimeOk = file.type === '' || file.type.startsWith(ALLOWED_MIME_PREFIX);
  const extOk = ext === '' || ALLOWED_EXTENSIONS.includes(ext);
  if (!mimeOk || !extOk) {
    return { ok: false, reason: 'Unsupported file type. Use .wav, .mp3, .ogg, .webm or .m4a.' };
  }

  const magicOk = await sniffMagicBytes(file);
  if (!magicOk) {
    return { ok: false, reason: 'File contents do not match a known audio format.' };
  }

  return { ok: true };
}
