import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AbonosService } from './abonos.service';
import { AbonosRepository } from './abonos.repository';
import { RemisionesService } from '../remisiones/remisiones.service';
import { AdministrativosService } from '../administrativos/administrativos.service';
import { FormaPago } from '../../common/enums/forma-pago.enum';
import { MetodoAbono } from '../../common/enums/metodo-abono.enum';
import { EstadoDocumento } from '../../common/enums/estado-documento.enum';

describe('AbonosService', () => {
  let service: AbonosService;

  const manager = { insert: jest.fn(), query: jest.fn() };
  const dataSource = {
    transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
  };
  const repository = {
    findByRemision: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    totalAbonado: jest.fn(),
    nextId: jest.fn(),
  };
  const remisionesService = { findOne: jest.fn() };
  const administrativosService = { assertSeleccionable: jest.fn() };

  /** Remisión a crédito de 1.000.000 (2 renglones de 10 x 50.000). */
  const remisionCredito = (extra = {}) => ({
    numero: 'REM-0015',
    formaPago: FormaPago.CREDITO,
    estado: EstadoDocumento.ACTIVO,
    items: [
      { pares: 10, precioUnitario: 50000, estado: EstadoDocumento.ACTIVO },
      { pares: 10, precioUnitario: 50000, estado: EstadoDocumento.ACTIVO },
    ],
    ...extra,
  });

  const dto = (monto: number) => ({
    monto,
    metodo: MetodoAbono.TRANSFERENCIA,
    registradoPorId: 'ADM-01',
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AbonosService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: AbonosRepository, useValue: repository },
        { provide: RemisionesService, useValue: remisionesService },
        {
          provide: AdministrativosService,
          useValue: administrativosService,
        },
      ],
    }).compile();
    service = module.get(AbonosService);

    dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
      cb(manager),
    );
    repository.nextId.mockResolvedValue('AB-0001');
    repository.findOne.mockResolvedValue({ id: 'AB-0001' });
  });

  describe('estadoCuenta', () => {
    it('calcula saldo = total - abonado', async () => {
      remisionesService.findOne.mockResolvedValue(remisionCredito());
      repository.totalAbonado.mockResolvedValue(300000);

      const r = await service.estadoCuenta('REM-0015');

      expect(r.total).toBe(1000000);
      expect(r.abonado).toBe(300000);
      expect(r.saldo).toBe(700000);
      expect(r.saldada).toBe(false);
    });

    // Un renglón anulado devolvió la mercancía: el cliente ya no lo debe.
    it('ignora los renglones anulados en el total', async () => {
      remisionesService.findOne.mockResolvedValue(
        remisionCredito({
          items: [
            {
              pares: 10,
              precioUnitario: 50000,
              estado: EstadoDocumento.ACTIVO,
            },
            {
              pares: 10,
              precioUnitario: 50000,
              estado: EstadoDocumento.ANULADO,
            },
          ],
        }),
      );
      repository.totalAbonado.mockResolvedValue(0);

      const r = await service.estadoCuenta('REM-0015');
      expect(r.total).toBe(500000);
    });

    it('marca saldada cuando no queda nada', async () => {
      remisionesService.findOne.mockResolvedValue(remisionCredito());
      repository.totalAbonado.mockResolvedValue(1000000);

      const r = await service.estadoCuenta('REM-0015');
      expect(r.saldo).toBe(0);
      expect(r.saldada).toBe(true);
    });
  });

  describe('create', () => {
    it('registra un abono dentro del saldo', async () => {
      remisionesService.findOne.mockResolvedValue(remisionCredito());
      repository.totalAbonado.mockResolvedValue(0);

      await service.create('REM-0015', dto(400000));

      expect(manager.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'AB-0001',
          remisionId: 'REM-0015',
          monto: 400000,
          metodo: MetodoAbono.TRANSFERENCIA,
        }),
      );
    });

    // Recibir de más no es un abono: o está mal tipeado, o el cliente pagó otra
    // cosa y hay que registrarlo donde corresponde.
    it('rechaza un abono mayor al saldo', async () => {
      remisionesService.findOne.mockResolvedValue(remisionCredito());
      repository.totalAbonado.mockResolvedValue(800000); // saldo: 200.000

      await expect(service.create('REM-0015', dto(200001))).rejects.toThrow(
        /supera el saldo pendiente/,
      );
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('acepta el abono que salda exacto', async () => {
      remisionesService.findOne.mockResolvedValue(remisionCredito());
      repository.totalAbonado.mockResolvedValue(800000);

      await service.create('REM-0015', dto(200000));
      expect(manager.insert).toHaveBeenCalled();
    });

    it('rechaza abonar una remisión ya saldada', async () => {
      remisionesService.findOne.mockResolvedValue(remisionCredito());
      repository.totalAbonado.mockResolvedValue(1000000);

      await expect(service.create('REM-0015', dto(1))).rejects.toThrow(
        /ya está saldada/,
      );
    });

    // Efectivo y transferencia se cobran al emitir: no hay deuda que abonar.
    it('rechaza abonar una remisión de contado', async () => {
      remisionesService.findOne.mockResolvedValue(
        remisionCredito({ formaPago: FormaPago.EFECTIVO }),
      );

      await expect(service.create('REM-0015', dto(1000))).rejects.toThrow(
        /se pagó de contado/,
      );
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('rechaza abonar una remisión anulada', async () => {
      remisionesService.findOne.mockResolvedValue(
        remisionCredito({ estado: EstadoDocumento.ANULADO }),
      );

      await expect(service.create('REM-0015', dto(1000))).rejects.toThrow(
        /está anulada/,
      );
    });

    // El saldo se relee DENTRO de la transacción: validar afuera dejaría pasar
    // dos cobros simultáneos.
    it('relee el saldo usando el manager de la transacción', async () => {
      remisionesService.findOne.mockResolvedValue(remisionCredito());
      repository.totalAbonado.mockResolvedValue(0);

      await service.create('REM-0015', dto(100000));

      expect(repository.totalAbonado).toHaveBeenCalledWith('REM-0015', manager);
    });
  });

  describe('anular', () => {
    it('marca el abono y deja el motivo', async () => {
      repository.findOne.mockResolvedValue({
        id: 'AB-0001',
        estado: EstadoDocumento.ACTIVO,
      });

      await service.anular('AB-0001', '  Cargado dos veces  ', 'ADM-01');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: EstadoDocumento.ANULADO,
          motivoAnulacion: 'Cargado dos veces',
          anuladoPorId: 'ADM-01',
          anuladoEn: expect.any(Date) as Date,
        }),
      );
    });

    it('no anula dos veces', async () => {
      repository.findOne.mockResolvedValue({
        id: 'AB-0001',
        estado: EstadoDocumento.ANULADO,
      });

      await expect(
        service.anular('AB-0001', 'Otra vez', 'ADM-01'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('un abono inexistente da 404', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(
        service.anular('AB-9999', 'Motivo válido', 'ADM-01'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
