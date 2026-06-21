import { MIME_A_EXT, tieneFirmaDeImagen } from './image-validation.util';

describe('image-validation', () => {
  it('mapea cada mimetype permitido a su extensión', () => {
    expect(MIME_A_EXT['image/jpeg']).toBe('jpg');
    expect(MIME_A_EXT['image/png']).toBe('png');
    expect(MIME_A_EXT['image/webp']).toBe('webp');
    expect(MIME_A_EXT['image/svg+xml']).toBeUndefined();
  });

  const pngReal = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const jpegReal = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  const webpReal = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'ascii'),
  ]);
  const textoPlano = Buffer.from('esto no es una imagen, es texto', 'ascii');

  it('acepta imágenes reales con su firma correcta', () => {
    expect(tieneFirmaDeImagen(pngReal, 'image/png')).toBe(true);
    expect(tieneFirmaDeImagen(jpegReal, 'image/jpeg')).toBe(true);
    expect(tieneFirmaDeImagen(webpReal, 'image/webp')).toBe(true);
  });

  it('rechaza un archivo de texto disfrazado de imagen (el ataque)', () => {
    expect(tieneFirmaDeImagen(textoPlano, 'image/jpeg')).toBe(false);
    expect(tieneFirmaDeImagen(textoPlano, 'image/png')).toBe(false);
  });

  it('rechaza si la firma no coincide con el mimetype declarado', () => {
    expect(tieneFirmaDeImagen(pngReal, 'image/jpeg')).toBe(false);
    expect(tieneFirmaDeImagen(jpegReal, 'image/png')).toBe(false);
  });

  it('rechaza buffers vacíos o demasiado cortos', () => {
    expect(tieneFirmaDeImagen(Buffer.from([0xff, 0xd8]), 'image/jpeg')).toBe(
      false,
    );
    expect(tieneFirmaDeImagen(Buffer.alloc(0), 'image/png')).toBe(false);
  });
});
