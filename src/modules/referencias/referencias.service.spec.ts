import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReferenciasService } from './referencias.service';
import { ReferenciasRepository } from './referencias.repository';
import { MaterialesService } from '../materiales/materiales.service';

// PNG mínimo válido: magic bytes reales para pasar tieneFirmaDeImagen.
const PNG_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);

const archivo = (mimetype: string, buffer: Buffer): Express.Multer.File =>
  ({ mimetype, buffer }) as Express.Multer.File;

describe('ReferenciasService (imágenes)', () => {
  let service: ReferenciasService;

  const repository = {
    findByIdWithRelations: jest.fn(),
    guardarImagen: jest.fn(),
    obtenerImagen: jest.fn(),
    borrarImagen: jest.fn(),
  };
  const materialesService = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ReferenciasService,
        { provide: ReferenciasRepository, useValue: repository },
        { provide: MaterialesService, useValue: materialesService },
      ],
    }).compile();
    service = module.get(ReferenciasService);
  });

  it('uploadImagen con referencia inexistente → 404 y no guarda', async () => {
    repository.findByIdWithRelations.mockResolvedValue(null);

    await expect(
      service.uploadImagen('REF-999', archivo('image/png', PNG_BUFFER)),
    ).rejects.toThrow(NotFoundException);
    expect(repository.guardarImagen).not.toHaveBeenCalled();
  });

  it('uploadImagen con mimetype no permitido → 400', async () => {
    repository.findByIdWithRelations.mockResolvedValue({ id: 'REF-001' });

    await expect(
      service.uploadImagen('REF-001', archivo('image/svg+xml', PNG_BUFFER)),
    ).rejects.toThrow(BadRequestException);
    expect(repository.guardarImagen).not.toHaveBeenCalled();
  });

  it('uploadImagen con contenido sin firma de imagen → 400', async () => {
    repository.findByIdWithRelations.mockResolvedValue({ id: 'REF-001' });

    await expect(
      service.uploadImagen(
        'REF-001',
        archivo('image/png', Buffer.from('<?php echo "no soy png"; ?>')),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(repository.guardarImagen).not.toHaveBeenCalled();
  });

  it('uploadImagen feliz: guarda el binario con la extensión decidida por el servidor', async () => {
    repository.findByIdWithRelations.mockResolvedValue({ id: 'REF-001' });
    repository.guardarImagen.mockResolvedValue({
      id: 'REF-001',
      imagenExt: 'png',
    });

    const result = await service.uploadImagen(
      'REF-001',
      archivo('image/png', PNG_BUFFER),
    );

    expect(repository.guardarImagen).toHaveBeenCalledWith(
      'REF-001',
      'png',
      PNG_BUFFER,
    );
    expect(result.imagenExt).toBe('png');
  });

  it('getImagen sin imagen asociada → 404', async () => {
    repository.findByIdWithRelations.mockResolvedValue({
      id: 'REF-001',
      imagenExt: null,
    });

    await expect(service.getImagen('REF-001')).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.obtenerImagen).not.toHaveBeenCalled();
  });

  it('getImagen con flag pero sin fila en BD → 404 (inconsistencia)', async () => {
    repository.findByIdWithRelations.mockResolvedValue({
      id: 'REF-001',
      imagenExt: 'png',
    });
    repository.obtenerImagen.mockResolvedValue(null);

    await expect(service.getImagen('REF-001')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getImagen feliz: devuelve binario, mime y fecha de actualización', async () => {
    const actualizadoEn = new Date('2026-07-01T10:00:00Z');
    repository.findByIdWithRelations.mockResolvedValue({
      id: 'REF-001',
      imagenExt: 'webp',
    });
    repository.obtenerImagen.mockResolvedValue({
      referenciaId: 'REF-001',
      datos: PNG_BUFFER,
      actualizadoEn,
    });

    const result = await service.getImagen('REF-001');

    expect(result).toEqual({
      datos: PNG_BUFFER,
      mimeType: 'image/webp',
      actualizadoEn,
    });
  });

  it('deleteImagen sin imagen: no toca la BD y devuelve la referencia', async () => {
    const referencia = { id: 'REF-001', imagenExt: null };
    repository.findByIdWithRelations.mockResolvedValue(referencia);

    const result = await service.deleteImagen('REF-001');

    expect(repository.borrarImagen).not.toHaveBeenCalled();
    expect(result).toBe(referencia);
  });

  it('deleteImagen con imagen: borra fila y limpia el flag', async () => {
    repository.findByIdWithRelations.mockResolvedValue({
      id: 'REF-001',
      imagenExt: 'jpg',
    });
    repository.borrarImagen.mockResolvedValue({
      id: 'REF-001',
      imagenExt: null,
    });

    const result = await service.deleteImagen('REF-001');

    expect(repository.borrarImagen).toHaveBeenCalledWith('REF-001');
    expect(result.imagenExt).toBeNull();
  });
});
