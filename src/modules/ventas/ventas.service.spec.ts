import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { VentasRepository } from './ventas.repository';
import { ValesService } from '../vales/vales.service';

describe('VentasService', () => {
  let service: VentasService;

  const repository = {
    findAllWithRelations: jest.fn(),
    findByIdWithRelations: jest.fn(),
    createAndSave: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const valesService = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        VentasService,
        { provide: VentasRepository, useValue: repository },
        { provide: ValesService, useValue: valesService },
      ],
    }).compile();
    service = module.get(VentasService);
  });

  it('create con vale inexistente → 404 y no crea nada', async () => {
    valesService.findOne.mockRejectedValue(new NotFoundException());

    await expect(
      service.create({ valeId: 'V-9999', pares: 5, precioUnitario: 95000 }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.createAndSave).not.toHaveBeenCalled();
  });

  it('create feliz: aplica fecha por defecto y retorna la venta con relaciones', async () => {
    valesService.findOne.mockResolvedValue({ id: 'V-0001' });
    repository.createAndSave.mockResolvedValue({ id: 'VT-0002' });
    repository.findByIdWithRelations.mockResolvedValue({
      id: 'VT-0002',
      valeId: 'V-0001',
    });

    const result = await service.create({
      valeId: 'V-0001',
      pares: 5,
      precioUnitario: 95000,
    });

    expect(repository.createAndSave).toHaveBeenCalledWith(
      expect.objectContaining({
        valeId: 'V-0001',
        pares: 5,
        precioUnitario: 95000,
        fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    expect(result.id).toBe('VT-0002');
  });

  it('remove con venta inexistente → 404', async () => {
    repository.findByIdWithRelations.mockResolvedValue(null);
    await expect(service.remove('VT-9999')).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.remove).not.toHaveBeenCalled();
  });
});
