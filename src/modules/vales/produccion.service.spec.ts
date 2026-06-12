import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProduccionService } from './produccion.service';
import { ProduccionRepository } from './produccion.repository';
import { ValesService } from './vales.service';
import { OperariosService } from '../operarios/operarios.service';
import { ReferenciasService } from '../referencias/referencias.service';
import { Oficio } from '../../common/enums/oficio.enum';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';
import { EntityManager } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('ProduccionService', () => {
  let service: ProduccionService;

  const mockManager = {
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    create: jest.fn(),
  };

  const repository = {
    findById: jest.fn(),
    registrarProduccionAtomico: jest.fn(),
    updateEstadoAtomico: jest.fn(),
    removeReg: jest.fn(),
    dataSource: {
      transaction: jest.fn(<T>(cb: (m: typeof mockManager) => T) =>
        cb(mockManager),
      ),
    },
    manager: {
      find: jest.fn(),
    },
  };
  const valesService = { findOne: jest.fn() };
  const operariosService = { findOne: jest.fn() };
  const referenciasService = { findOne: jest.fn() };
  const auditoriaService = { registrar: jest.fn() };

  const manager = {} as EntityManager;

  const vale = {
    id: 'V-0001',
    referenciaId: 'REF-001',
    tallas: [
      { talla: 40, cantidad: 10 },
      { talla: 41, cantidad: 10 },
    ],
  };

  const referencia = {
    id: 'REF-001',
    nombre: 'Air Runner Pro',
    tarifas: [
      { oficio: Oficio.CORTADOR, valor: 1200 },
      { oficio: Oficio.GUARNECEDOR, valor: 3500 },
    ],
  };

  const regBase = {
    id: 'reg-1',
    valeId: 'V-0001',
    etapa: Oficio.CORTADOR,
    operarioId: 'OP-01',
    pares: 10,
    estado: EstadoProduccion.REGISTRADO,
    montoPagado: 0,
    vale: { referenciaId: 'REF-001' },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    repository.dataSource.transaction.mockImplementation(
      <T>(cb: (m: typeof mockManager) => T) => cb(mockManager),
    );
    const module = await Test.createTestingModule({
      providers: [
        ProduccionService,
        { provide: ProduccionRepository, useValue: repository },
        { provide: ValesService, useValue: valesService },
        { provide: OperariosService, useValue: operariosService },
        { provide: ReferenciasService, useValue: referenciasService },
        { provide: AuditoriaService, useValue: auditoriaService },
      ],
    }).compile();
    service = module.get(ProduccionService);
  });

  describe('updateEstado — máquina de estados', () => {
    it('registrado → aprobado congela el monto (pares × tarifa)', async () => {
      const reg = { ...regBase };
      repository.findById.mockResolvedValue(reg);
      referenciasService.findOne.mockResolvedValue(referencia);
      repository.updateEstadoAtomico.mockResolvedValue(true);

      await service.updateEstado('V-0001', 'reg-1', EstadoProduccion.APROBADO);

      expect(repository.updateEstadoAtomico).toHaveBeenCalledWith(
        'reg-1',
        EstadoProduccion.REGISTRADO,
        EstadoProduccion.APROBADO,
        12000, // 10 pares × 1200
        mockManager,
      );
    });

    it('registrado → aprobado sin tarifa para el oficio → 400', async () => {
      const reg = { ...regBase, etapa: Oficio.SOLADOR };
      repository.findById.mockResolvedValue(reg);
      referenciasService.findOne.mockResolvedValue(referencia);

      await expect(
        service.updateEstado('V-0001', 'reg-1', EstadoProduccion.APROBADO),
      ).rejects.toThrow(BadRequestException);
      expect(repository.updateEstadoAtomico).not.toHaveBeenCalled();
    });

    it('aprobado → registrado devuelve el monto a 0', async () => {
      const reg = {
        ...regBase,
        estado: EstadoProduccion.APROBADO,
        montoPagado: 12000,
      };
      repository.findById.mockResolvedValue(reg);
      repository.updateEstadoAtomico.mockResolvedValue(true);

      await service.updateEstado(
        'V-0001',
        'reg-1',
        EstadoProduccion.REGISTRADO,
      );

      expect(repository.updateEstadoAtomico).toHaveBeenCalledWith(
        'reg-1',
        EstadoProduccion.APROBADO,
        EstadoProduccion.REGISTRADO,
        0,
        mockManager,
      );
    });

    it('aprobado → pagado sin manager → 400 (solo módulo de pagos)', async () => {
      const reg = {
        ...regBase,
        estado: EstadoProduccion.APROBADO,
        montoPagado: 12000,
      };
      repository.findById.mockResolvedValue(reg);

      await expect(
        service.updateEstado('V-0001', 'reg-1', EstadoProduccion.PAGADO),
      ).rejects.toThrow(BadRequestException);
    });

    it('aprobado → pagado con manager procede manteniendo el monto', async () => {
      const reg = {
        ...regBase,
        estado: EstadoProduccion.APROBADO,
        montoPagado: 12000,
      };
      repository.findById.mockResolvedValue(reg);
      repository.updateEstadoAtomico.mockResolvedValue(true);

      await service.updateEstado(
        'V-0001',
        'reg-1',
        EstadoProduccion.PAGADO,
        manager,
      );

      expect(repository.updateEstadoAtomico).toHaveBeenCalledWith(
        'reg-1',
        EstadoProduccion.APROBADO,
        EstadoProduccion.PAGADO,
        12000,
        manager,
      );
    });

    it('pagado → aprobado sin manager → 400 (anulación solo por pagos)', async () => {
      const reg = {
        ...regBase,
        estado: EstadoProduccion.PAGADO,
        montoPagado: 12000,
      };
      repository.findById.mockResolvedValue(reg);

      await expect(
        service.updateEstado('V-0001', 'reg-1', EstadoProduccion.APROBADO),
      ).rejects.toThrow(BadRequestException);
    });

    it('pagado → aprobado con manager procede', async () => {
      const reg = {
        ...regBase,
        estado: EstadoProduccion.PAGADO,
        montoPagado: 12000,
      };
      repository.findById.mockResolvedValue(reg);
      repository.updateEstadoAtomico.mockResolvedValue(true);

      await service.updateEstado(
        'V-0001',
        'reg-1',
        EstadoProduccion.APROBADO,
        manager,
      );

      expect(repository.updateEstadoAtomico).toHaveBeenCalledWith(
        'reg-1',
        EstadoProduccion.PAGADO,
        EstadoProduccion.APROBADO,
        12000,
        manager,
      );
    });

    it('registrado → pagado → 400 (transición inválida)', async () => {
      repository.findById.mockResolvedValue({ ...regBase });

      await expect(
        service.updateEstado(
          'V-0001',
          'reg-1',
          EstadoProduccion.PAGADO,
          manager,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('pagado → registrado → 400 (transición inválida)', async () => {
      repository.findById.mockResolvedValue({
        ...regBase,
        estado: EstadoProduccion.PAGADO,
      });

      await expect(
        service.updateEstado(
          'V-0001',
          'reg-1',
          EstadoProduccion.REGISTRADO,
          manager,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('registro de otro vale → 404', async () => {
      repository.findById.mockResolvedValue({
        ...regBase,
        valeId: 'V-9999',
      });

      await expect(
        service.updateEstado('V-0001', 'reg-1', EstadoProduccion.APROBADO),
      ).rejects.toThrow(NotFoundException);
    });

    it('mismo estado → no-op que retorna el registro', async () => {
      const reg = { ...regBase };
      repository.findById.mockResolvedValue(reg);

      const result = await service.updateEstado(
        'V-0001',
        'reg-1',
        EstadoProduccion.REGISTRADO,
      );

      expect(result).toBe(reg);
      expect(repository.updateEstadoAtomico).not.toHaveBeenCalled();
    });

    it('conflicto de concurrencia (affected 0) → 409', async () => {
      const reg = { ...regBase };
      repository.findById.mockResolvedValue(reg);
      referenciasService.findOne.mockResolvedValue(referencia);
      repository.updateEstadoAtomico.mockResolvedValue(false);

      await expect(
        service.updateEstado('V-0001', 'reg-1', EstadoProduccion.APROBADO),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('registerProduccion — cupo', () => {
    const dto = { etapa: Oficio.CORTADOR, operarioId: 'OP-01', pares: 20 };

    it('hasta el límite exacto del vale pasa', async () => {
      valesService.findOne.mockResolvedValue(vale);
      operariosService.findOne.mockResolvedValue({ id: 'OP-01' });
      repository.registrarProduccionAtomico.mockResolvedValue({
        reg: { id: 'reg-9' },
        paresYaRegistrados: 0,
      });
      repository.findById.mockResolvedValue({ ...regBase, id: 'reg-9' });

      const result = await service.registerProduccion('V-0001', dto);

      expect(repository.registrarProduccionAtomico).toHaveBeenCalledWith({
        valeId: 'V-0001',
        etapa: Oficio.CORTADOR,
        operarioId: 'OP-01',
        pares: 20,
        totalParesVale: 20,
      });
      expect(result.id).toBe('reg-9');
    });

    it('por encima del cupo → 400 con cifras', async () => {
      valesService.findOne.mockResolvedValue(vale);
      operariosService.findOne.mockResolvedValue({ id: 'OP-01' });
      repository.registrarProduccionAtomico.mockResolvedValue({
        reg: null,
        paresYaRegistrados: 15,
      });

      await expect(service.registerProduccion('V-0001', dto)).rejects.toThrow(
        /Cupo superado/,
      );
    });

    it('vale inexistente → 404 propagado', async () => {
      valesService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.registerProduccion('V-9999', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.registrarProduccionAtomico).not.toHaveBeenCalled();
    });

    it('operario inexistente → 404 propagado', async () => {
      valesService.findOne.mockResolvedValue(vale);
      operariosService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.registerProduccion('V-0001', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.registrarProduccionAtomico).not.toHaveBeenCalled();
    });
  });

  describe('deleteRegistro', () => {
    it('registro pagado → 400', async () => {
      repository.findById.mockResolvedValue({
        ...regBase,
        estado: EstadoProduccion.PAGADO,
      });

      await expect(service.deleteRegistro('V-0001', 'reg-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.removeReg).not.toHaveBeenCalled();
    });

    it('registro de otro vale → 404', async () => {
      repository.findById.mockResolvedValue({ ...regBase, valeId: 'V-9999' });

      await expect(service.deleteRegistro('V-0001', 'reg-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('registro no pagado se elimina', async () => {
      const reg = { ...regBase, estado: EstadoProduccion.APROBADO };
      repository.findById.mockResolvedValue(reg);

      await service.deleteRegistro('V-0001', 'reg-1');

      expect(repository.removeReg).toHaveBeenCalledWith(reg, mockManager);
    });
  });

  describe('findOne', () => {
    it('inexistente → 404', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('revisar', () => {
    const dtoAprobacionTotal = { paresAprobados: 10 };
    const dtoAprobacionParcial = {
      paresAprobados: 7,
      motivo: 'Costura defectuosa',
    };
    const dtoAprobacionParcialSinMotivo = { paresAprobados: 7 };
    const dtoRechazoTotal = { paresAprobados: 0, motivo: 'Todo mal hecho' };

    it('aprobación total cambia estado a aprobado, congela monto y guarda datos de revisor', async () => {
      const reg = { ...regBase };
      mockManager.findOne.mockResolvedValue(reg);
      referenciasService.findOne.mockResolvedValue(referencia);

      const res = await service.revisar(
        'V-0001',
        'reg-1',
        dtoAprobacionTotal,
        'admin-user',
      );

      expect(mockManager.findOne).toHaveBeenCalled();
      expect(reg.estado).toBe(EstadoProduccion.APROBADO);
      expect(reg.pares).toBe(10);
      expect(reg.montoPagado).toBe(12000); // 10 * 1200
      expect(reg.revisadoPor).toBe('admin-user');
      expect(reg.revisadoEn).toBeInstanceOf(Date);
      expect(mockManager.save).toHaveBeenCalledWith(expect.anything(), reg);
      expect(res.deleted).toBe(false);
      expect(res.paresAprobados).toBe(10);
      expect(res.paresRechazados).toBe(0);
    });

    it('aprobación parcial guarda rechazo y actualiza registro de producción', async () => {
      const reg = { ...regBase };
      mockManager.findOne.mockResolvedValue(reg);
      referenciasService.findOne.mockResolvedValue(referencia);
      mockManager.create.mockReturnValue({});

      const res = await service.revisar(
        'V-0001',
        'reg-1',
        dtoAprobacionParcial,
        'admin-user',
      );

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          valeId: 'V-0001',
          etapa: Oficio.CORTADOR,
          operarioId: 'OP-01',
          pares: 3,
          motivo: 'Costura defectuosa',
        }),
      );
      expect(mockManager.save).toHaveBeenCalled();
      expect(reg.pares).toBe(7);
      expect(reg.estado).toBe(EstadoProduccion.APROBADO);
      expect(reg.montoPagado).toBe(8400); // 7 * 1200
      expect(res.deleted).toBe(false);
      expect(res.paresAprobados).toBe(7);
      expect(res.paresRechazados).toBe(3);
    });

    it('aprobación parcial sin motivo → 400', async () => {
      const reg = { ...regBase };
      mockManager.findOne.mockResolvedValue(reg);

      await expect(
        service.revisar(
          'V-0001',
          'reg-1',
          dtoAprobacionParcialSinMotivo,
          'admin-user',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechazo total archiva rechazo y elimina el registro de producción', async () => {
      const reg = { ...regBase };
      mockManager.findOne.mockResolvedValue(reg);
      mockManager.create.mockReturnValue({});

      const res = await service.revisar(
        'V-0001',
        'reg-1',
        dtoRechazoTotal,
        'admin-user',
      );

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          pares: 10,
          motivo: 'Todo mal hecho',
        }),
      );
      expect(mockManager.remove).toHaveBeenCalledWith(expect.anything(), reg);
      expect(res.deleted).toBe(true);
      expect(res.paresAprobados).toBe(0);
      expect(res.paresRechazados).toBe(10);
    });

    it('estado del registro diferente a REGISTRADO → 400', async () => {
      const reg = { ...regBase, estado: EstadoProduccion.APROBADO };
      mockManager.findOne.mockResolvedValue(reg);

      await expect(
        service.revisar('V-0001', 'reg-1', dtoAprobacionTotal, 'admin-user'),
      ).rejects.toThrow(BadRequestException);
    });

    it('cantidad de pares aprobados mayor que el registro → 400', async () => {
      const reg = { ...regBase };
      mockManager.findOne.mockResolvedValue(reg);

      await expect(
        service.revisar(
          'V-0001',
          'reg-1',
          { paresAprobados: 15 },
          'admin-user',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
