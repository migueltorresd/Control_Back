import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AbonosRepository } from './abonos.repository';
import { Abono } from './entities/abono.entity';
import { CreateAbonoDto } from './dto/create-abono.dto';
import { RemisionesService } from '../remisiones/remisiones.service';
import { AdministrativosService } from '../administrativos/administrativos.service';
import { FormaPago } from '../../common/enums/forma-pago.enum';
import { EstadoDocumento } from '../../common/enums/estado-documento.enum';
import { hoyLocal } from '../../common/utils/fecha.util';

/** Cuánto vale una remisión: la suma de sus renglones vigentes. */
export interface EstadoCuenta {
  total: number;
  abonado: number;
  saldo: number;
  saldada: boolean;
}

@Injectable()
export class AbonosService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly repository: AbonosRepository,
    private readonly remisionesService: RemisionesService,
    private readonly administrativosService: AdministrativosService,
  ) {}

  findByRemision(remisionId: string): Promise<Abono[]> {
    return this.repository.findByRemision(remisionId);
  }

  /**
   * Estado de cuenta de una remisión.
   *
   * El total sale de los renglones y el abonado de los abonos vigentes: ningún
   * número se guarda, porque un saldo almacenado se desincroniza de sus abonos
   * al primer error y deja dos cifras contradiciéndose.
   */
  async estadoCuenta(remisionId: string): Promise<EstadoCuenta> {
    const remision = await this.remisionesService.findOne(remisionId);
    const total = (remision.items || [])
      .filter((v) => v.estado !== EstadoDocumento.ANULADO)
      .reduce((sum, v) => sum + v.pares * v.precioUnitario, 0);

    const abonado = await this.repository.totalAbonado(remisionId);
    const saldo = Number((total - abonado).toFixed(2));

    return { total, abonado, saldo, saldada: saldo <= 0 };
  }

  /**
   * Registra un abono del cliente contra una remisión a crédito.
   *
   * Todo dentro de una transacción y releyendo el saldo adentro: si dos
   * personas cobran a la vez, validar afuera dejaría pasar los dos abonos y la
   * remisión terminaría con más plata recibida que deuda.
   */
  async create(remisionId: string, dto: CreateAbonoDto): Promise<Abono> {
    const remision = await this.remisionesService.findOne(remisionId);

    if (remision.estado === EstadoDocumento.ANULADO) {
      throw new BadRequestException(
        `La remisión ${remisionId} está anulada: no admite abonos.`,
      );
    }

    // Efectivo y transferencia se cobran al emitir el documento; solo el
    // crédito deja una deuda que abonar.
    if (remision.formaPago !== FormaPago.CREDITO) {
      throw new BadRequestException(
        `La remisión ${remisionId} se pagó de contado (${remision.formaPago.toLowerCase()}): no tiene saldo pendiente.`,
      );
    }

    await this.administrativosService.assertSeleccionable(dto.registradoPorId);

    const fecha = dto.fecha || hoyLocal();

    const id = await this.dataSource.transaction(async (manager) => {
      const { saldo } = await this.estadoCuentaEn(remisionId, manager);

      if (saldo <= 0) {
        throw new BadRequestException(
          `La remisión ${remisionId} ya está saldada.`,
        );
      }
      // Recibir de más no es un abono: o está mal tipeado, o el cliente pagó
      // otra cosa y hay que registrarlo donde corresponde.
      if (dto.monto > saldo) {
        throw new BadRequestException(
          `El abono de ${dto.monto} supera el saldo pendiente de ${saldo}.`,
        );
      }

      const nuevoId = await this.repository.nextId(manager);
      await manager.insert(Abono, {
        id: nuevoId,
        remisionId,
        fecha,
        monto: dto.monto,
        metodo: dto.metodo,
        observaciones: dto.observaciones ?? null,
        registradoPorId: dto.registradoPorId,
      });
      return nuevoId;
    });

    return this.findOne(id);
  }

  async findOne(id: string): Promise<Abono> {
    const abono = await this.repository.findOne(id);
    if (!abono) throw new NotFoundException(`Abono ${id} no encontrado`);
    return abono;
  }

  /**
   * Anula un abono mal registrado. La deuda del cliente vuelve a subir.
   *
   * No se borra: hay que poder ver que se cargó y que alguien lo deshizo, o la
   * cobranza queda sin explicación para el cliente que sí pagó.
   */
  async anular(
    id: string,
    motivo: string,
    anuladoPorId: string,
  ): Promise<Abono> {
    const abono = await this.findOne(id);

    if (abono.estado === EstadoDocumento.ANULADO) {
      throw new BadRequestException(`El abono ${id} ya está anulado.`);
    }

    await this.administrativosService.assertSeleccionable(anuladoPorId);

    abono.estado = EstadoDocumento.ANULADO;
    abono.motivoAnulacion = motivo.trim();
    abono.anuladoPorId = anuladoPorId;
    abono.anuladoEn = new Date();
    await this.repository.save(abono);

    return this.findOne(id);
  }

  /** Igual que `estadoCuenta`, pero dentro de una transacción en curso. */
  private async estadoCuentaEn(
    remisionId: string,
    manager: Parameters<typeof this.repository.totalAbonado>[1],
  ): Promise<EstadoCuenta> {
    const remision = await this.remisionesService.findOne(remisionId);
    const total = (remision.items || [])
      .filter((v) => v.estado !== EstadoDocumento.ANULADO)
      .reduce((sum, v) => sum + v.pares * v.precioUnitario, 0);

    const abonado = await this.repository.totalAbonado(remisionId, manager);
    const saldo = Number((total - abonado).toFixed(2));

    return { total, abonado, saldo, saldada: saldo <= 0 };
  }
}
