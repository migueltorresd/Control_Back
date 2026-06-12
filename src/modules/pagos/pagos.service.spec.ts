import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagosRepository } from './pagos.repository';
import { ProduccionService } from '../vales/produccion.service';
import { Pago } from './entities/pago.entity';
import { ProduccionReg } from '../vales/entities/produccion-reg.entity';
import { Vale } from '../vales/entities/vale.entity';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';
import { Oficio } from '../../common/enums/oficio.enum';

describe('PagosService', () => {
  let service: PagosService;

  // Lo que el manager de la transacción devuelve en cada test
  let regEnBd: Partial<ProduccionReg> | null;
  let valeEnBd: Partial<Vale> | null;
  let pagoEnBd: Partial<Pago> | null;

  const manager = {
    findOne: jest.fn((entity: unknown) => {
      if (entity === ProduccionReg) return Promise.resolve(regEnBd);
      if (entity === Vale) return Promise.resolve(valeEnBd);
      if (entity === Pago) return Promise.resolve(pagoEnBd);
      return Promise.resolve(null);
    }),
    insert: jest.fn(),
    findOneByOrFail: jest.fn((_entity: unknown, where: { id: string }) =>
      Promise.resolve({ id: where.id } as Pago),
    ),
    delete: jest.fn(),
  };

  const repository = {
    dataSource: {
      transaction: jest.fn((cb: (m: typeof manager) => unknown) =>
        cb(manager),
      ),
    },
    nextId: jest.fn().mockResolvedValue('PG-0002'),
    findAllOrdered: jest.fn(),
    findByOperario: jest.fn(),
  };

  const produccionService = { updateEstado: jest.fn() };

  const regAprobado: Partial<ProduccionReg> = {
    id: 'reg-1',
    valeId: 'V-0001',
    etapa: Oficio.CORTADOR,
    operarioId: 'OP-01',
    pares: 10,
    estado: EstadoProduccion.APROBADO,
    montoPagado: 12000,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    regEnBd = null;
    valeEnBd = null;
    pagoEnBd = null;

    const module = await Test.createTestingModule({
      providers: [
        PagosService,
        { provide: PagosRepository, useValue: repository },
        { provide: ProduccionService, useValue: produccionService },
      ],
    }).compile();
    service = module.get(PagosService);
  });

  describe('pagar', () => {
    it('registro inexistente → 404', async () => {
      regEnBd = null;
      await expect(service.pagar('nope')).rejects.toThrow(NotFoundException);
    });

    it('registro no aprobado → 400', async () => {
      regEnBd = { ...regAprobado, estado: EstadoProduccion.REGISTRADO };
      await expect(service.pagar('reg-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('registro ya pagado → 400 (evita doble pago)', async () => {
      regEnBd = { ...regAprobado, estado: EstadoProduccion.PAGADO };
      await expect(service.pagar('reg-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('camino feliz: usa el monto congelado y marca pagado en la misma transacción', async () => {
      regEnBd = { ...regAprobado };
      valeEnBd = { id: 'V-0001', referenciaId: 'REF-001' };

      const pago = await service.pagar('reg-1');

      expect(produccionService.updateEstado).toHaveBeenCalledWith(
        'V-0001',
        'reg-1',
        EstadoProduccion.PAGADO,
        manager,
      );
      expect(manager.insert).toHaveBeenCalledWith(
        Pago,
        expect.objectContaining({
          id: 'PG-0002',
          monto: 12000, // monto congelado, no recalculado
          produccionRegId: 'reg-1',
          refId: 'REF-001',
        }),
      );
      expect(pago.id).toBe('PG-0002');
    });
  });

  describe('pagarLote', () => {
    it('inconsistencia vale/etapa → 400 y no inserta nada', async () => {
      regEnBd = { ...regAprobado };
      await expect(
        service.pagarLote([
          { vale: 'V-9999', etapa: 'Cortador', regId: 'reg-1' },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('registro no aprobado en el lote → 400', async () => {
      regEnBd = { ...regAprobado, estado: EstadoProduccion.REGISTRADO };
      await expect(
        service.pagarLote([
          { vale: 'V-0001', etapa: 'Cortador', regId: 'reg-1' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('camino feliz: un pago por registro con el monto congelado', async () => {
      regEnBd = { ...regAprobado };
      valeEnBd = { id: 'V-0001', referenciaId: 'REF-001' };

      const pagos = await service.pagarLote([
        { vale: 'V-0001', etapa: 'Cortador', regId: 'reg-1' },
      ]);

      expect(pagos).toHaveLength(1);
      expect(manager.insert).toHaveBeenCalledTimes(1);
      expect(produccionService.updateEstado).toHaveBeenCalledTimes(1);
    });
  });

  describe('anularPagoPorRegistro', () => {
    it('sin comprobante de pago → 404', async () => {
      regEnBd = { ...regAprobado, estado: EstadoProduccion.PAGADO };
      pagoEnBd = null;
      await expect(service.anularPagoPorRegistro('reg-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('camino feliz: revierte a aprobado y borra el comprobante', async () => {
      regEnBd = { ...regAprobado, estado: EstadoProduccion.PAGADO };
      pagoEnBd = {
        id: 'PG-0002',
        valeId: 'V-0001',
        produccionRegId: 'reg-1',
      };

      await service.anularPagoPorRegistro('reg-1');

      expect(produccionService.updateEstado).toHaveBeenCalledWith(
        'V-0001',
        'reg-1',
        EstadoProduccion.APROBADO,
        manager,
      );
      expect(manager.delete).toHaveBeenCalledWith(Pago, 'PG-0002');
    });
  });
});
