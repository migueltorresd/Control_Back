import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PagosRepository } from './pagos.repository';
import { ProduccionService } from '../vales/produccion.service';
import { Pago } from './entities/pago.entity';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';
import { Oficio } from '../../common/enums/oficio.enum';
import { ProduccionReg } from '../vales/entities/produccion-reg.entity';
import { Vale } from '../vales/entities/vale.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { hoyLocal } from '../../common/utils/fecha.util';

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    private readonly repository: PagosRepository,
    private readonly produccionService: ProduccionService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async findAllPaginated(opts: {
    page: number;
    limit: number;
    operarioId?: string;
    desde?: string;
    hasta?: string;
  }): Promise<{ data: Pago[]; total: number }> {
    const [data, total] = await this.repository.findPaginated({
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      operarioId: opts.operarioId,
      desde: opts.desde,
      hasta: opts.hasta,
    });
    return { data, total };
  }

  async findAll(operarioId?: string): Promise<Pago[]> {
    if (operarioId) {
      return this.repository.findByOperario(operarioId);
    }
    return this.repository.findAllOrdered();
  }

  // Pagar un solo registro
  async pagar(regId: string, username?: string): Promise<Pago> {
    return this.repository.dataSource.transaction(async (manager) => {
      // 1. Obtener el registro de producción y bloquearlo con pessimistic_write (sin join)
      const reg = await manager.findOne(ProduccionReg, {
        where: { id: regId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!reg) {
        throw new NotFoundException(
          `Registro de producción con ID ${regId} no encontrado`,
        );
      }

      // 2. Validar que esté aprobado
      if (reg.estado !== EstadoProduccion.APROBADO) {
        throw new BadRequestException(
          `El registro de producción ${regId} no está en estado aprobado. Estado actual: ${reg.estado}`,
        );
      }

      // 3. Obtener el vale por separado para tener referenciaId
      const vale = await manager.findOne(Vale, {
        where: { id: reg.valeId },
      });

      if (!vale) {
        throw new NotFoundException(`Vale con ID ${reg.valeId} no encontrado`);
      }

      const fecha = hoyLocal();

      // 4. Generar el ID secuencial del pago
      const pagoId = await this.repository.nextId(manager);

      const pagoData = {
        id: pagoId,
        fecha,
        operarioId: reg.operarioId,
        valeId: reg.valeId,
        etapa: reg.etapa,
        pares: reg.pares,
        monto: reg.montoPagado, // Usa el monto congelado
        refId: vale.referenciaId,
        produccionRegId: reg.id,
      };

      // 5. Actualizar el estado de la producción a PAGADO
      await this.produccionService.updateEstado(
        reg.valeId,
        reg.id,
        EstadoProduccion.PAGADO,
        manager,
      );

      // 6. Insertar el pago (insert, no save: nunca sobrescribir)
      await manager.insert(Pago, pagoData);

      this.logger.log(
        `Pago creado: Comprobante ${pagoId} registrado por ${username || 'system'} para el operario ${reg.operarioId} en el vale ${reg.valeId} (etapa: ${reg.etapa}, pares: ${reg.pares}, monto: ${reg.montoPagado}, regId: ${reg.id})`,
      );

      // Registrar auditoría
      await this.auditoriaService.registrar(
        {
          usuario: username || 'system',
          accion: 'PAGAR',
          entidad: 'Pago',
          entidadId: pagoId,
          detalle: {
            regId,
            valeId: reg.valeId,
            operarioId: reg.operarioId,
            etapa: reg.etapa,
            pares: reg.pares,
            monto: reg.montoPagado,
          },
        },
        manager,
      );

      return manager.findOneByOrFail(Pago, { id: pagoId });
    });
  }

  // Pagar lote de registros
  async pagarLote(
    items: { vale: string; etapa: Oficio; regId: string }[],
    username?: string,
  ): Promise<Pago[]> {
    return this.repository.dataSource.transaction(async (manager) => {
      const pagos: Pago[] = [];
      const fecha = hoyLocal();

      for (const item of items) {
        // 1. Obtener y bloquear cada registro con pessimistic_write (sin join)
        const reg = await manager.findOne(ProduccionReg, {
          where: { id: item.regId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!reg) {
          throw new NotFoundException(
            `Registro de producción con ID ${item.regId} no encontrado`,
          );
        }

        // 2. Validar inconsistencias
        if (reg.valeId !== item.vale || reg.etapa !== item.etapa) {
          throw new BadRequestException(
            `Inconsistencia: El registro ${item.regId} no coincide con el vale ${item.vale} o la etapa ${item.etapa}`,
          );
        }

        if (reg.estado !== EstadoProduccion.APROBADO) {
          throw new BadRequestException(
            `El registro ${item.regId} no está aprobado para pago. Estado: ${reg.estado}`,
          );
        }

        // 3. Obtener el vale por separado para tener referenciaId
        const vale = await manager.findOne(Vale, {
          where: { id: reg.valeId },
        });

        if (!vale) {
          throw new NotFoundException(
            `Vale con ID ${reg.valeId} no encontrado`,
          );
        }

        // 4. Generar el ID secuencial del pago
        const pagoId = await this.repository.nextId(manager);

        const pagoData = {
          id: pagoId,
          fecha,
          operarioId: reg.operarioId,
          valeId: reg.valeId,
          etapa: reg.etapa,
          pares: reg.pares,
          monto: reg.montoPagado, // Usa el monto congelado
          refId: vale.referenciaId,
          produccionRegId: reg.id,
        };

        // 5. Actualizar el estado de la producción
        await this.produccionService.updateEstado(
          reg.valeId,
          reg.id,
          EstadoProduccion.PAGADO,
          manager,
        );

        // 6. Insertar el pago (insert, no save: nunca sobrescribir)
        await manager.insert(Pago, pagoData);
        const savedPago = await manager.findOneByOrFail(Pago, { id: pagoId });
        pagos.push(savedPago);

        this.logger.log(
          `Pago creado (Lote): Comprobante ${pagoId} registrado por ${username || 'system'} para el operario ${reg.operarioId} en el vale ${reg.valeId} (etapa: ${reg.etapa}, pares: ${reg.pares}, monto: ${reg.montoPagado}, regId: ${reg.id})`,
        );

        // Registrar auditoría
        await this.auditoriaService.registrar(
          {
            usuario: username || 'system',
            accion: 'PAGAR',
            entidad: 'Pago',
            entidadId: pagoId,
            detalle: {
              regId: reg.id,
              valeId: reg.valeId,
              operarioId: reg.operarioId,
              etapa: reg.etapa,
              pares: reg.pares,
              monto: reg.montoPagado,
              lote: true,
            },
          },
          manager,
        );
      }

      return pagos;
    });
  }

  // Anular un pago (por el ID del registro de producción)
  async anularPagoPorRegistro(regId: string, username?: string): Promise<void> {
    return this.repository.dataSource.transaction(async (manager) => {
      // 1. Buscar el comprobante de pago asociado a la producción
      const reg = await manager.findOne(ProduccionReg, {
        where: { id: regId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!reg) {
        throw new NotFoundException(
          `No existe un registro de producción con ID ${regId}`,
        );
      }

      const pago = await manager.findOne(Pago, {
        where: { produccionRegId: regId },
      });
      if (!pago) {
        throw new NotFoundException(
          `No existe un comprobante de pago para el registro de producción ${regId}`,
        );
      }

      // 2. Revertir el estado de la producción a aprobado
      await this.produccionService.updateEstado(
        pago.valeId,
        pago.produccionRegId,
        EstadoProduccion.APROBADO,
        manager,
      );

      // 3. Borrar el comprobante de pago
      await manager.delete(Pago, pago.id);

      this.logger.log(
        `Pago anulado: Comprobante ${pago.id} para el operario ${pago.operarioId} en el vale ${pago.valeId} (etapa: ${pago.etapa}, pares: ${pago.pares}, monto: ${pago.monto}, regId: ${regId}) anulado por ${username || 'system'}`,
      );

      // Registrar auditoría
      await this.auditoriaService.registrar(
        {
          usuario: username || 'system',
          accion: 'ANULAR_PAGO',
          entidad: 'Pago',
          entidadId: pago.id,
          detalle: {
            regId,
            valeId: pago.valeId,
            operarioId: pago.operarioId,
            etapa: pago.etapa,
            pares: pago.pares,
            monto: pago.monto,
          },
        },
        manager,
      );
    });
  }
}
