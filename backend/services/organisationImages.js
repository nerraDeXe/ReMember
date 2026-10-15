import { MAX_IMAGE_SIZE } from '../../shared/imageUploads.js';

export function normaliseOrganisationImage(value, label) {
  if (typeof value !== 'string') throw new Error(`Provide a valid ${label} image.`);
  const source = value.trim();
  if (!source) return '';

  // Existing remote images remain supported when an owner edits other fields.
  if (/^https?:\/\//i.test(source) && source.length <= 1000) {
    try {
      const url = new URL(source);
      if (url.hostname && !url.username && !url.password) return source;
    } catch { /* Report invalid image input below. */ }
  }

  if (!source.startsWith('data:')) throw new Error(`Upload a JPEG, PNG, or WebP ${label} image.`);
  if (source.length > Math.ceil(MAX_IMAGE_SIZE / 3) * 4 + 40) throw new Error(`${label} images must be 2 MB or smaller.`);
  const match = source.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[2].length % 4 !== 0) throw new Error(`Upload a JPEG, PNG, or WebP ${label} image.`);
  if (Buffer.byteLength(match[2], 'base64') > MAX_IMAGE_SIZE) throw new Error(`${label} images must be 2 MB or smaller.`);

  const bytes = Buffer.from(match[2], 'base64');
  const validSignature = match[1] === 'png'
    ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : match[1] === 'jpeg'
      ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!validSignature || bytes.toString('base64') !== match[2]) throw new Error(`Provide a valid ${label} image.`);
  return source;
}
