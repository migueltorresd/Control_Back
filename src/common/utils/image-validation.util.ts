/**
 * Validación de imágenes subidas. El mimetype lo declara el cliente, así que
 * la extensión en disco la decide el servidor y el contenido se confirma por
 * sus magic bytes (no se confía en el nombre ni el mimetype declarado).
 */

/** Mimetype validado → extensión que escribe el servidor. */
export const MIME_A_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Verifica los primeros bytes del archivo contra la firma del formato declarado. */
export function tieneFirmaDeImagen(buffer: Buffer, mimetype: string): boolean {
  if (!buffer || buffer.length < 12) return false;
  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimetype === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}
