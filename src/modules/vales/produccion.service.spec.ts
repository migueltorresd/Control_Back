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

describe('ProduccionService', () => {
  let service: ProduccionService;

  const repository = {
    findById: jest.fn(),
    registrarProduccionAtomico: jest.fn(),
    updateEstadoAtomico: jest.fn(),
    removeReg: jest.fn(),
  };
  const valesService = { findOne: jest.fn() };
  const operariosService = { findOne: jest.fn() };
  const referenciasService = { findOne: jest.fn() };

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
    const module = await Test.createTestingModule({
      providers: [
        ProduccionService,
        { provide: ProduccionRepository, useValue: repository },
        { provide: ValesService, useValue: valesService },
        { provide: OperariosService, useValue: operariosService },
        { provide: ReferenciasService, useValue: referenciasService },
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
        undefined,
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
        undefined,
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

      await expect(
        service.registerProduccion('V-0001', dto),
      ).rejects.toThrow(/Cupo superado/);
    });

    it('vale inexistente → 404 propagado', async () => {
      valesService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.registerProduccion('V-9999', dto),
      ).rejects.toThrow(NotFoundException);
      expect(repository.registrarProduccionAtomico).not.toHaveBeenCalled();
    });

    it('operario inexistente → 404 propagado', async () => {
      valesService.findOne.mockResolvedValue(vale);
      operariosService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.registerProduccion('V-0001', dto),
      ).rejects.toThrow(NotFoundException);
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

      expect(repository.removeReg).toHaveBeenCalledWith(reg, undefined);
    });
  });

  describe('findOne', () => {
    it('inexistente → 404', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
