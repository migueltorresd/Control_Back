import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PagosRepository } from './pagos.repository';
import { ProduccionService } from '../vales/produccion.service';
import { Pago } from './entities/pago.entity';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';
import { ProduccionReg } from '../vales/entities/produccion-reg.entity';
import { Vale } from '../vales/entities/vale.entity';

@Injectable()
export class PagosService {
  constructor(
    private readonly repository: PagosRepository,
    private readonly produccionService: ProduccionService,
  ) {}

  async findAll(operarioId?: string): Promise<Pago[]> {
    if (operarioId) {
      return this.repository.findByOperario(operarioId);
    }
    return this.repository.findAllOrdered();
  }

  // Pagar un solo registro
  async pagar(regId: string): Promise<Pago> {
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
        throw new NotFoundException(
          `Vale con ID ${reg.valeId} no encontrado`,
        );
      }

      const fecha = new Date().toISOString().split('T')[0];

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
      return manager.findOneByOrFail(Pago, { id: pagoId });
    });
  }

  // Pagar lote de registros
  async pagarLote(
    items: { vale: string; etapa: string; regId: string }[],
  ): Promise<Pago[]> {
    return this.repository.dataSource.transaction(async (manager) => {
      const pagos: Pago[] = [];
      const fecha = new Date().toISOString().split('T')[0];

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
        pagos.push(await manager.findOneByOrFail(Pago, { id: pagoId }));
      }

      return pagos;
    });
  }

  // Anular un pago (por el ID del registro de producción)
  async anularPagoPorRegistro(regId: string): Promise<void> {
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
    });
  }
}
