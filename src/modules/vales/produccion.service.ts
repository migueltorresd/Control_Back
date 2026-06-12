import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProduccionRepository } from './produccion.repository';
import { ValesService } from './vales.service';
import { OperariosService } from '../operarios/operarios.service';
import { ReferenciasService } from '../referencias/referencias.service';
import { RegisterProduccionDto } from './dto/register-produccion.dto';
import { ProduccionReg } from './entities/produccion-reg.entity';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';

@Injectable()
export class ProduccionService {
  constructor(
    private readonly repository: ProduccionRepository,
    private readonly valesService: ValesService,
    private readonly operariosService: OperariosService,
    private readonly referenciasService: ReferenciasService,
  ) {}

  async findOne(id: string): Promise<ProduccionReg> {
    const reg = await this.repository.findById(id);
    if (!reg) {
      throw new NotFoundException(
        `Registro de producción con ID ${id} no encontrado`,
      );
    }
    return reg;
  }

  async registerProduccion(
    valeId: string,
    dto: RegisterProduccionDto,
  ): Promise<ProduccionReg> {
    // 1. Validar que el vale exista (e inyectar sus tallas/relaciones)
    const vale = await this.valesService.findOne(valeId);

    // 2. Validar que el operario exista
    await this.operariosService.findOne(dto.operarioId);

    // 3. Calcular el cupo total del vale (no cambia durante la operación)
    const totalParesVale = vale.tallas.reduce((acc, t) => acc + t.cantidad, 0);

    // 4. Registrar de forma atómica: bloqueo de vale + validación de cupo + insert
    const { reg, paresYaRegistrados } =
      await this.repository.registrarProduccionAtomico({
        valeId,
        etapa: dto.etapa,
        operarioId: dto.operarioId,
        pares: dto.pares,
        totalParesVale,
      });

    if (!reg) {
      throw new BadRequestException(
        `Cupo superado en la etapa ${dto.etapa}. Se intentan registrar ${dto.pares} pares, pero ya hay ${paresYaRegistrados} de un límite de ${totalParesVale} pares en el vale.`,
      );
    }

    // 5. Recargar con relaciones completas para la respuesta
    return this.repository.findById(reg.id) as Promise<ProduccionReg>;
  }

  async updateEstado(
    valeId: string,
    regId: string,
    nuevoEstado: EstadoProduccion,
    manager?: EntityManager,
  ): Promise<ProduccionReg> {
    // 1. Buscar el registro de producción y validar su pertenencia al vale
    const reg = await this.repository.findById(regId);
    if (!reg || reg.valeId !== valeId) {
      throw new NotFoundException(
        `Registro de producción con ID ${regId} no pertenece al vale ${valeId}`,
      );
    }

    const estadoActual = reg.estado;

    // Si no hay cambio, retornar directo
    if (estadoActual === nuevoEstado) {
      return reg;
    }

    let nuevoMonto = reg.montoPagado;

    // 2. Validar la máquina de estados y aplicar lógica
    if (
      estadoActual === EstadoProduccion.REGISTRADO &&
      nuevoEstado === EstadoProduccion.APROBADO
    ) {
      // Transición: registrado -> aprobado (congelar monto)
      const ref = await this.referenciasService.findOne(reg.vale.referenciaId);
      const tarifaObj = ref.tarifas.find((t) => t.oficio === reg.etapa);

      if (!tarifaObj) {
        throw new BadRequestException(
          `No se puede aprobar la producción porque la referencia ${ref.nombre} no tiene tarifa definida para el oficio ${reg.etapa}`,
        );
      }

      nuevoMonto = reg.pares * tarifaObj.valor;
    } else if (
      estadoActual === EstadoProduccion.APROBADO &&
      nuevoEstado === EstadoProduccion.REGISTRADO
    ) {
      // Transición: aprobado -> registrado (revertir y volver monto a 0)
      nuevoMonto = 0;
    } else if (
      estadoActual === EstadoProduccion.APROBADO &&
      nuevoEstado === EstadoProduccion.PAGADO
    ) {
      // Transición: aprobado -> pagado (solo mediante transacción de Pagos)
      if (!manager) {
        throw new BadRequestException(
          `No se permite cambiar el estado a PAGADO manualmente. El pago debe registrarse mediante el módulo de pagos.`,
        );
      }
      // Mantener nuevoMonto actual
    } else if (
      estadoActual === EstadoProduccion.PAGADO &&
      nuevoEstado === EstadoProduccion.APROBADO
    ) {
      // Transición: pagado -> aprobado (solo mediante transacción de Pagos para anular)
      if (!manager) {
        throw new BadRequestException(
          `No se permite revertir un registro PAGADO manualmente. La anulación debe procesarse mediante el módulo de pagos.`,
        );
      }
      // Mantener nuevoMonto actual
    } else {
      // Cualquier otra transición no está permitida por diseño
      throw new BadRequestException(
        `Transición de estado inválida: no se permite cambiar de ${estadoActual} a ${nuevoEstado} de forma directa.`,
      );
    }

    // 3. Persistir de forma atómica: UPDATE WHERE estado = estadoActual
    const actualizado = await this.repository.updateEstadoAtomico(
      regId,
      estadoActual,
      nuevoEstado,
      nuevoMonto,
      manager,
    );

    if (!actualizado) {
      throw new ConflictException(
        'El registro fue modificado por otra operación. Recargue e intente de nuevo.',
      );
    }

    return this.repository.findById(regId) as Promise<ProduccionReg>;
  }

  async deleteRegistro(
    valeId: string,
    regId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const reg = await this.repository.findById(regId);
    if (!reg || reg.valeId !== valeId) {
      throw new NotFoundException(
        `Registro de producción con ID ${regId} no pertenece al vale ${valeId}`,
      );
    }

    // No permitir eliminar registros liquidados (pagados) para mantener integridad
    if (reg.estado === EstadoProduccion.PAGADO) {
      throw new BadRequestException(
        `No se puede eliminar un registro de producción que ya fue pagado.`,
      );
    }

    await this.repository.removeReg(reg, manager);
  }
}
