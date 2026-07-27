import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ValesService } from './vales.service';
import { ValesRepository } from './vales.repository';
import { ReferenciasService } from '../referencias/referencias.service';
import { AdministrativosService } from '../administrativos/administrativos.service';

describe('ValesService', () => {
  let service: ValesService;

  const repository = {
    findAllWithRelations: jest.fn(),
    findByIdWithRelations: jest.fn(),
    crearConRelaciones: jest.fn(),
    update: jest.fn(),
  };
  const referenciasService = { findOne: jest.fn() };
  const administrativosService = { assertSeleccionable: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ValesService,
        { provide: ValesRepository, useValue: repository },
        { provide: ReferenciasService, useValue: referenciasService },
        {
          provide: AdministrativosService,
          useValue: administrativosService,
        },
      ],
    }).compile();
    service = module.get(ValesService);
  });

  it('findOne inexistente → 404', async () => {
    repository.findByIdWithRelations.mockResolvedValue(null);
    await expect(service.findOne('V-9999')).rejects.toThrow(NotFoundException);
  });

  it('create con referencia inexistente → 404 y no crea nada', async () => {
    referenciasService.findOne.mockRejectedValue(new NotFoundException());

    await expect(
      service.create({
        fecha: '2026-06-11',
        almacen: 'Principal',
        color: 'Negro',
        altura: 'Media',
        referenciaId: 'REF-NOPE',
        tallas: [{ talla: 40, cantidad: 5 }],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.crearConRelaciones).not.toHaveBeenCalled();
  });

  it('create feliz delega al repositorio transaccional', async () => {
    referenciasService.findOne.mockResolvedValue({ id: 'REF-001' });
    repository.crearConRelaciones.mockResolvedValue({ id: 'V-0003' });

    const result = await service.create({
      fecha: '2026-06-11',
      almacen: 'Principal',
      color: 'Negro',
      altura: 'Media',
      referenciaId: 'REF-001',
      tallas: [{ talla: 40, cantidad: 5 }],
    });

    expect(repository.crearConRelaciones).toHaveBeenCalledWith(
      expect.objectContaining({ referenciaId: 'REF-001' }),
      [{ talla: 40, cantidad: 5 }],
    );
    expect(result.id).toBe('V-0003');
  });

  it('create con administrativo inactivo → 400 y no crea nada', async () => {
    referenciasService.findOne.mockResolvedValue({ id: 'REF-001' });
    administrativosService.assertSeleccionable.mockRejectedValue(
      new BadRequestException(),
    );

    await expect(
      service.create({
        fecha: '2026-06-11',
        almacen: 'Principal',
        color: 'Negro',
        altura: 'Media',
        referenciaId: 'REF-001',
        creadoPorId: 'ADM-01',
        tallas: [{ talla: 40, cantidad: 5 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.crearConRelaciones).not.toHaveBeenCalled();
  });

  it('create sin responsable guarda creadoPorId en null', async () => {
    referenciasService.findOne.mockResolvedValue({ id: 'REF-001' });
    repository.crearConRelaciones.mockResolvedValue({ id: 'V-0003' });

    await service.create({
      fecha: '2026-06-11',
      almacen: 'Principal',
      color: 'Negro',
      altura: 'Media',
      referenciaId: 'REF-001',
      tallas: [{ talla: 40, cantidad: 5 }],
    });

    expect(administrativosService.assertSeleccionable).not.toHaveBeenCalled();
    expect(repository.crearConRelaciones).toHaveBeenCalledWith(
      expect.objectContaining({ creadoPorId: null }),
      [{ talla: 40, cantidad: 5 }],
    );
  });

  it('asignarResponsable valida el vale y el administrativo antes de guardar', async () => {
    repository.findByIdWithRelations.mockResolvedValue({ id: 'V-0004' });

    await service.asignarResponsable('V-0004', 'ADM-02');

    expect(administrativosService.assertSeleccionable).toHaveBeenCalledWith(
      'ADM-02',
    );
    expect(repository.update).toHaveBeenCalledWith('V-0004', {
      creadoPorId: 'ADM-02',
    });
  });
});
