import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { RemisionesService } from './remisiones.service';
import { RemisionesRepository } from './remisiones.repository';
import { VentasRepository } from '../ventas/ventas.repository';
import { ValesService } from '../vales/vales.service';
import { AdministrativosService } from '../administrativos/administrativos.service';
import { FormaPago } from '../../common/enums/forma-pago.enum';

describe('RemisionesService', () => {
  let service: RemisionesService;

  const manager = { insert: jest.fn(), update: jest.fn() };
  const dataSource = {
    transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
  };
  const repository = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    nextNumero: jest.fn(),
  };
  const ventasRepository = { nextId: jest.fn() };
  const valesService = {
    findOne: jest.fn(),
    assertVigente: jest.fn(),
    assertStockSuficiente: jest.fn(),
  };
  const administrativosService = { assertSeleccionable: jest.fn() };

  const dto = (items: { valeId: string; pares: number }[]) => ({
    clienteNombre: 'Distribuciones El Portal',
    formaPago: FormaPago.EFECTIVO,
    items: items.map((i) => ({ ...i, precioUnitario: 85000 })),
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RemisionesService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: RemisionesRepository, useValue: repository },
        { provide: VentasRepository, useValue: ventasRepository },
        { provide: ValesService, useValue: valesService },
        {
          provide: AdministrativosService,
          useValue: administrativosService,
        },
      ],
    }).compile();
    service = module.get(RemisionesService);

    dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
      cb(manager),
    );
    repository.nextNumero.mockResolvedValue('REM-0001');
    ventasRepository.nextId.mockResolvedValue('VT-0001');
    repository.findOne.mockResolvedValue({ numero: 'REM-0001', items: [] });
  });

  it('no emite una remisión contra un vale anulado', async () => {
    valesService.assertVigente.mockImplementation(() => {
      throw new BadRequestException('anulado');
    });
    await expect(
      service.create(dto([{ valeId: 'V-0001', pares: 5 }])),
    ).rejects.toThrow(BadRequestException);
    expect(manager.insert).not.toHaveBeenCalled();
  });

  /**
   * El caso que rompe una validación ingenua: dos renglones del MISMO vale.
   * Validando renglón por renglón, dos de 10 pasan contra un stock de 15 y la
   * remisión despacha 20 pares que no existen.
   */
  it('suma los pares por vale cuando el mismo vale aparece en varios renglones', async () => {
    await service.create(
      dto([
        { valeId: 'V-0001', pares: 10 },
        { valeId: 'V-0001', pares: 10 },
        { valeId: 'V-0002', pares: 4 },
      ]),
    );

    expect(valesService.assertStockSuficiente).toHaveBeenCalledWith(
      'V-0001',
      20,
      manager,
    );
    expect(valesService.assertStockSuficiente).toHaveBeenCalledWith(
      'V-0002',
      4,
      manager,
    );
    expect(valesService.assertStockSuficiente).toHaveBeenCalledTimes(2);
  });

  it('valida el stock DENTRO de la transacción, antes de insertar', async () => {
    const orden: string[] = [];
    valesService.assertStockSuficiente.mockImplementation(() => {
      orden.push('valida');
      return Promise.resolve();
    });
    manager.insert.mockImplementation(() => {
      orden.push('insert');
      return Promise.resolve();
    });

    await service.create(dto([{ valeId: 'V-0001', pares: 5 }]));

    expect(orden[0]).toBe('valida');
    expect(orden).toContain('insert');
  });

  it('si falta stock no inserta nada', async () => {
    valesService.assertStockSuficiente.mockRejectedValue(
      new BadRequestException('sin stock'),
    );
    await expect(
      service.create(dto([{ valeId: 'V-0001', pares: 99 }])),
    ).rejects.toThrow(BadRequestException);
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('anular una remisión inexistente → 404', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(
      service.anular('REM-9999', 'Devolución completa', 'ADM-01'),
    ).rejects.toThrow(NotFoundException);
  });
});
