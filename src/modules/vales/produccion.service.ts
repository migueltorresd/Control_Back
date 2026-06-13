import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { EntityManager, FindOptionsWhere } from 'typeorm';
import { ProduccionRepository } from './produccion.repository';
import { ValesService } from './vales.service';
import { OperariosService } from '../operarios/operarios.service';
import { ReferenciasService } from '../referencias/referencias.service';
import { RegisterProduccionDto } from './dto/register-produccion.dto';
import { RevisarProduccionDto } from './dto/revisar-produccion.dto';
import { ProduccionReg } from './entities/produccion-reg.entity';
import { Rechazo } from './entities/rechazo.entity';
import { Vale } from './entities/vale.entity';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';
import { AuditoriaService } from '../auditoria/auditoria.service';

export interface ResultadoRevision {
  success: boolean;
  deleted: boolean;
  paresAprobados: number;
  paresRechazados: number;
}

@Injectable()
export class ProduccionService {
  private readonly logger = new Logger(ProduccionService.name);

  constructor(
    private readonly repository: ProduccionRepository,
    private readonly valesService: ValesService,
    private readonly operariosService: OperariosService,
    private readonly referenciasService: ReferenciasService,
    private readonly auditoriaService: AuditoriaService,
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
    username?: string,
  ): Promise<ProduccionReg> {
    const execute = async (mgr: EntityManager) => {
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
        const ref = await this.referenciasService.findOne(
          reg.vale.referenciaId,
        );
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
        mgr,
      );

      if (!actualizado) {
        throw new ConflictException(
          'El registro fue modificado por otra operación. Recargue e intente de nuevo.',
        );
      }

      // 4. Registrar en auditoría
      let accion = '';
      if (
        estadoActual === EstadoProduccion.APROBADO &&
        nuevoEstado === EstadoProduccion.REGISTRADO
      ) {
        accion = 'REVERTIR_PRODUCCION';
      } else if (
        estadoActual === EstadoProduccion.REGISTRADO &&
        nuevoEstado === EstadoProduccion.APROBADO
      ) {
        accion = 'APROBAR_PRODUCCION';
      }

      if (accion) {
        await this.auditoriaService.registrar(
          {
            usuario: username || 'system',
            accion,
            entidad: 'ProduccionReg',
            entidadId: regId,
            detalle: {
              valeId,
              montoAnterior: reg.montoPagado,
              montoNuevo: nuevoMonto,
              estadoAnterior: estadoActual,
              estadoNuevo: nuevoEstado,
            },
          },
          mgr,
        );
      }

      return this.repository.findById(regId) as Promise<ProduccionReg>;
    };

    if (manager) {
      return execute(manager);
    } else {
      return this.repository.dataSource.transaction(async (mgr) => {
        return execute(mgr);
      });
    }
  }

  async deleteRegistro(
    valeId: string,
    regId: string,
    username?: string,
    manager?: EntityManager,
  ): Promise<void> {
    const execute = async (mgr: EntityManager) => {
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

      // 1. Eliminar el registro
      await this.repository.removeReg(reg, mgr);

      // 2. Registrar en auditoría
      await this.auditoriaService.registrar(
        {
          usuario: username || 'system',
          accion: 'ELIMINAR_REGISTRO',
          entidad: 'ProduccionReg',
          entidadId: regId,
          detalle: {
            valeId: reg.valeId,
            etapa: reg.etapa,
            operarioId: reg.operarioId,
            pares: reg.pares,
            estado: reg.estado,
            montoPagado: reg.montoPagado,
          },
        },
        mgr,
      );
    };

    if (manager) {
      await execute(manager);
    } else {
      await this.repository.dataSource.transaction(async (mgr) => {
        await execute(mgr);
      });
    }
  }

  async revisar(
    valeId: string,
    regId: string,
    dto: RevisarProduccionDto,
    username: string | null,
  ): Promise<ResultadoRevision> {
    return this.repository.dataSource.transaction(async (manager) => {
      // 1. Obtener y bloquear el registro con pessimistic_write (sin join)
      const reg = await manager.findOne(ProduccionReg, {
        where: { id: regId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!reg) {
        throw new NotFoundException(
          `Registro de producción con ID ${regId} no encontrado`,
        );
      }

      if (reg.valeId !== valeId) {
        throw new NotFoundException(
          `Registro de producción con ID ${regId} no pertenece al vale ${valeId}`,
        );
      }

      if (reg.estado !== EstadoProduccion.REGISTRADO) {
        throw new BadRequestException(
          `El registro de producción no está en estado REGISTRADO. Estado actual: ${reg.estado}`,
        );
      }

      const { paresAprobados } = dto;
      if (paresAprobados < 0 || paresAprobados > reg.pares) {
        throw new BadRequestException(
          `La cantidad de pares aprobados (${paresAprobados}) debe estar entre 0 y ${reg.pares}`,
        );
      }

      const motivoTrim = dto.motivo?.trim() ?? '';
      const paresRechazados = reg.pares - paresAprobados;
      if (paresRechazados > 0 && !motivoTrim) {
        throw new BadRequestException('Indique el motivo del rechazo');
      }

      // 2. Si hay rechazados, insertar en rechazos
      if (paresRechazados > 0) {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const localFecha = `${year}-${month}-${day}`;

        const rechazo = manager.create(Rechazo, {
          fecha: localFecha,
          valeId: reg.valeId,
          etapa: reg.etapa,
          operarioId: reg.operarioId,
          pares: paresRechazados,
          motivo: motivoTrim,
          registroId: reg.id,
        });
        await manager.save(Rechazo, rechazo);
      }

      // 3. Si paresAprobados === 0: eliminar registro de producción
      if (paresAprobados === 0) {
        await manager.remove(ProduccionReg, reg);

        this.logger.log(
          `Producción revertida: Registro ${reg.id} del vale ${reg.valeId} (etapa: ${reg.etapa}, operario: ${reg.operarioId}, pares originales: ${reg.pares}) fue revertido/eliminado por completo por el usuario ${username || 'system'}.`,
        );

        // Registrar auditoría
        await this.auditoriaService.registrar(
          {
            usuario: username || 'system',
            accion: 'ELIMINAR_REGISTRO',
            entidad: 'ProduccionReg',
            entidadId: regId,
            detalle: {
              valeId,
              etapa: reg.etapa,
              operarioId: reg.operarioId,
              pares: reg.pares,
              estado: reg.estado,
              montoPagado: reg.montoPagado,
              revert: true,
            },
          },
          manager,
        );

        return {
          success: true,
          deleted: true,
          paresAprobados: 0,
          paresRechazados,
        };
      }

      // Obtener el vale por separado para conocer la referencia
      const vale = await manager.findOne(Vale, {
        where: { id: reg.valeId },
      });
      if (!vale) {
        throw new NotFoundException(`Vale ${reg.valeId} no encontrado`);
      }

      // 4. Si paresAprobados > 0: calcular tarifa y actualizar
      const ref = await this.referenciasService.findOne(vale.referenciaId);
      const tarifaObj = ref.tarifas.find((t) => t.oficio === reg.etapa);
      if (!tarifaObj) {
        throw new BadRequestException(
          `No se puede aprobar la producción porque la referencia ${ref.nombre} no tiene tarifa definida para el oficio ${reg.etapa}`,
        );
      }

      const nuevoMonto = paresAprobados * tarifaObj.valor;
      reg.pares = paresAprobados;
      reg.estado = EstadoProduccion.APROBADO;
      reg.montoPagado = nuevoMonto;
      reg.revisadoPor = username;
      reg.revisadoEn = new Date();

      await manager.save(ProduccionReg, reg);

      this.logger.log(
        `Producción aprobada: Registro ${reg.id} del vale ${reg.valeId} (etapa: ${reg.etapa}, operario: ${reg.operarioId}) fue aprobado con ${paresAprobados} pares (monto congelado: ${nuevoMonto}) por el usuario ${username || 'system'}.`,
      );

      // Registrar auditoría
      await this.auditoriaService.registrar(
        {
          usuario: username || 'system',
          accion: 'APROBAR_PRODUCCION',
          entidad: 'ProduccionReg',
          entidadId: regId,
          detalle: {
            valeId,
            etapa: reg.etapa,
            operarioId: reg.operarioId,
            paresAprobados,
            paresRechazados,
            montoNuevo: nuevoMonto,
            estadoAnterior: reg.estado,
          },
        },
        manager,
      );

      return { success: true, deleted: false, paresAprobados, paresRechazados };
    });
  }

  async findRechazos(valeId?: string, operarioId?: string): Promise<Rechazo[]> {
    const where: FindOptionsWhere<Rechazo> = {};
    if (valeId) where.valeId = valeId;
    if (operarioId) where.operarioId = operarioId;
    return this.repository.manager.find(Rechazo, {
      where,
      order: { creadoEn: 'DESC' },
    });
  }
}
