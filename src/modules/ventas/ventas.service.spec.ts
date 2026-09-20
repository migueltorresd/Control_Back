import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { VentasRepository } from './ventas.repository';
import { ValesService } from '../vales/vales.service';
import { AdministrativosService } from '../administrativos/administrativos.service';
import { EstadoDocumento } from '../../common/enums/estado-documento.enum';

describe('VentasService', () => {
  let service: VentasService;

  const repository = {
    findAllWithRelations: jest.fn(),
    findByIdWithRelations: jest.fn(),
    createAndSave: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  // `assertVigente` y `assertStockSuficiente` no-op por defecto: su lógica se
  // prueba en vales.service.spec.ts. Acá solo importa que se llamen.
  const valesService = {
    findOne: jest.fn(),
    assertVigente: jest.fn(),
    assertStockSuficiente: jest.fn(),
  };
  const administrativosService = { assertSeleccionable: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        VentasService,
        { provide: VentasRepository, useValue: repository },
        { provide: ValesService, useValue: valesService },
        {
          provide: AdministrativosService,
          useValue: administrativosService,
        },
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
      }),
    );
    const calls = repository.createAndSave.mock.calls as [[{ fecha: string }]];
    expect(calls[0][0].fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.id).toBe('VT-0002');
  });

  it('anular una venta inexistente → 404', async () => {
    repository.findByIdWithRelations.mockResolvedValue(null);
    await expect(
      service.anular('VT-9999', 'Devolución del cliente', 'ADM-01'),
    ).rejects.toThrow(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('anular una venta ya anulada → 400', async () => {
    repository.findByIdWithRelations.mockResolvedValue({
      id: 'VT-0001',
      estado: EstadoDocumento.ANULADO,
      remisionId: null,
    });
    await expect(
      service.anular('VT-0001', 'Devolución del cliente', 'ADM-01'),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  // El papel ya lo firmó el cliente: agujerearlo por dentro dejaría el
  // documento entregado sin coincidir con el sistema.
  it('anular un renglón de una remisión → 400', async () => {
    repository.findByIdWithRelations.mockResolvedValue({
      id: 'VT-0001',
      estado: EstadoDocumento.ACTIVO,
      remisionId: 'REM-0151',
    });
    await expect(
      service.anular('VT-0001', 'Devolución del cliente', 'ADM-01'),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('anular una venta suelta la marca y deja el motivo', async () => {
    const venta = {
      id: 'VT-0001',
      estado: EstadoDocumento.ACTIVO,
      remisionId: null,
    };
    repository.findByIdWithRelations.mockResolvedValue(venta);

    await service.anular('VT-0001', '  Devolución del cliente  ', 'ADM-01');

    expect(administrativosService.assertSeleccionable).toHaveBeenCalledWith(
      'ADM-01',
    );
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: EstadoDocumento.ANULADO,
        motivoAnulacion: 'Devolución del cliente',
        anuladoPorId: 'ADM-01',
        anuladoEn: expect.any(Date) as Date,
      }),
    );
  });
});
