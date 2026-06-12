import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PagosRepository } from './pagos.repository';
import { ProduccionService } from '../vales/produccion.service';
import { Pago } from './entities/pago.entity';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';

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
    // 1. Obtener el registro de producción y validar su estado
    const reg = await this.produccionService.findOne(regId);
    if (reg.estado !== EstadoProduccion.APROBADO) {
      throw new BadRequestException(
        `El registro de producción ${regId} no está en estado aprobado. Estado actual: ${reg.estado}`,
      );
    }

    const fecha = new Date().toISOString().split('T')[0];

    const pagoData = {
      fecha,
      operarioId: reg.operarioId,
      valeId: reg.valeId,
      etapa: reg.etapa,
      pares: reg.pares,
      monto: reg.montoPagado, // Usa el monto congelado
      refId: reg.vale.referenciaId,
      produccionRegId: reg.id,
    };

    // 2. Ejecutar de forma transaccional la actualización de estado y la creación de comprobante
    return this.repository.registrarPagoTransaccional(
      pagoData,
      async (manager) => {
        await this.produccionService.updateEstado(
          reg.valeId,
          reg.id,
          EstadoProduccion.PAGADO,
          manager,
        );
      },
    );
  }

  // Pagar lote de registros
  async pagarLote(
    items: { vale: string; etapa: string; regId: string }[],
  ): Promise<Pago[]> {
    const validados: any[] = [];

    // 1. Validar que todos los registros de producción existan y estén aprobados
    for (const item of items) {
      const reg = await this.produccionService.findOne(item.regId);
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
      validados.push(reg);
    }

    const fecha = new Date().toISOString().split('T')[0];

    // 2. Preparar los payloads de pago (el ID lo genera la secuencia pagos_seq dentro de la transacción)
    const pagosData = validados.map((reg) => ({
      fecha,
      operarioId: reg.operarioId,
      valeId: reg.valeId,
      etapa: reg.etapa,
      pares: reg.pares,
      monto: reg.montoPagado, // Usa el monto congelado
      refId: reg.vale.referenciaId,
      produccionRegId: reg.id,
    }));

    // 3. Ejecutar la transacción en lote
    return this.repository.registrarPagosEnLoteTransaccional(
      pagosData,
      async (manager) => {
        for (const reg of validados) {
          await this.produccionService.updateEstado(
            reg.valeId,
            reg.id,
            EstadoProduccion.PAGADO,
            manager,
          );
        }
      },
    );
  }

  // Anular un pago (por el ID del registro de producción)
  async anularPagoPorRegistro(regId: string): Promise<void> {
    // 1. Buscar el comprobante de pago asociado a la producción
    const pago = await this.repository.findByProduccionReg(regId);
    if (!pago) {
      throw new NotFoundException(
        `No existe un comprobante de pago para el registro de producción ${regId}`,
      );
    }

    // 2. Anular transaccionalmente
    await this.repository.anularPagoTransaccional(pago.id, async (manager) => {
      // Revertir el estado de la producción a aprobado (el monto congelado permanece)
      await this.produccionService.updateEstado(
        pago.valeId,
        pago.produccionRegId,
        EstadoProduccion.APROBADO,
        manager,
      );
    });
  }
}
