import { Logger } from '@nestjs/common';
import sharp from 'sharp';

const logger = new Logger('ImagenParaPdf');

/** Lado máximo del thumbnail. El vale la dibuja a 62 pt: 300 px sobra para 300 dpi. */
const LADO_MAX = 300;

/**
 * Normaliza una imagen del catálogo a un PNG chico apto para incrustar en el PDF.
 *
 * Hace falta por dos razones concretas:
 * 1. pdfkit solo incrusta PNG y JPEG, y el catálogo acepta también webp (hoy la
 *    mayoría de las referencias están en webp).
 * 2. Hay fotos de varios MB; embeberlas crudas infla cada vale para una
 *    miniatura diminuta.
 *
 * Devuelve `undefined` si la imagen está corrupta o en un formato ilegible: el
 * vale debe imprimirse igual, sin foto, nunca fallar.
 */
export async function aPngParaPdf(datos: Buffer): Promise<Buffer | undefined> {
  try {
    return await sharp(datos)
      .rotate() // respeta la orientación EXIF de fotos tomadas con celular
      .resize(LADO_MAX, LADO_MAX, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (e) {
    logger.warn(
      `No se pudo convertir la imagen para el PDF: ${(e as Error).message}`,
    );
    return undefined;
  }
}
