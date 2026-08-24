import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EstadoDocumento } from '../../common/enums/estado-documento.enum';
import { AdministrativosService } from '../administrativos/administrativos.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RemisionesRepository } from './remisiones.repository';
import { Remision } from './entities/remision.entity';
import { CreateRemisionDto } from './dto/create-remision.dto';
import { Venta } from '../ventas/entities/venta.entity';
import { VentasRepository } from '../ventas/ventas.repository';
import { ValesService } from '../vales/vales.service';
import { hoyLocal } from '../../common/utils/fecha.util';

@Injectable()
export class RemisionesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly repository: RemisionesRepository,
    private readonly ventasRepository: VentasRepository,
    private readonly valesService: ValesService,
    private readonly administrativosService: AdministrativosService,
  ) {}

  findAll(): Promise<Remision[]> {
    return this.repository.findAll();
  }

  async findOne(numero: string): Promise<Remision> {
    const remision = await this.repository.findOne(numero);
    if (!remision) {
      throw new NotFoundException(`Remisión ${numero} no encontrada`);
    }
    return remision;
  }

  /**
   * Emite la remisión y, con ella, las ventas de cada renglón.
   *
   * Todo va en una sola transacción: una remisión a medio guardar —con papel
   * emitido pero sin las ventas que descuentan el stock— dejaría al taller
   * creyendo que tiene mercancía que ya salió por la puerta.
   */
  async create(dto: CreateRemisionDto): Promise<Remision> {
    // Ningún renglón puede salir de un vale que la administración dio de baja.
    for (const item of dto.items) {
      this.valesService.assertVigente(
        await this.valesService.findOne(item.valeId),
      );
    }

    const fecha = dto.fecha || hoyLocal();

    const numero = await this.dataSource.transaction(async (manager) => {
      const numero = await this.repository.nextNumero(manager);

      await manager.insert(Remision, {
        numero,
        fecha,
        clienteNombre: dto.clienteNombre,
        clienteDocumento: dto.clienteDocumento ?? null,
        clienteDireccion: dto.clienteDireccion ?? null,
        formaPago: dto.formaPago,
        observaciones: dto.observaciones ?? null,
      });

      for (const item of dto.items) {
        const id = await this.ventasRepository.nextId(manager);
        // insert, no save: ante colisión de ID debe fallar, nunca sobrescribir.
        await manager.insert(Venta, {
          id,
          fecha,
          valeId: item.valeId,
          pares: item.pares,
          precioUnitario: item.precioUnitario,
          remisionId: numero,
        });
      }

      return numero;
    });

    return this.findOne(numero);
  }

  /**
   * Anula la remisión y, con ella, todos sus renglones.
   *
   * Los renglones van sí o sí en la misma transacción: una remisión anulada con
   * sus ventas todavía vigentes sería un fantasma —el documento está de baja
   * pero la mercancía sigue descontada del depósito—. Al anularlas, el conteo
   * de vendidos las ignora y los pares vuelven a estar disponibles.
   */
  async anular(
    numero: string,
    motivo: string,
    anuladoPorId: string,
  ): Promise<Remision> {
    const remision = await this.findOne(numero);

    if (remision.estado === EstadoDocumento.ANULADO) {
      throw new BadRequestException(`La remisión ${numero} ya está anulada.`);
    }

    await this.administrativosService.assertSeleccionable(anuladoPorId);

    const anuladoEn = new Date();
    const baja = {
      estado: EstadoDocumento.ANULADO,
      motivoAnulacion: motivo.trim(),
      anuladoPorId,
      anuladoEn,
    };

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Remision, { numero }, baja);
      await manager.update(
        Venta,
        { remisionId: numero, estado: EstadoDocumento.ACTIVO },
        {
          ...baja,
          motivoAnulacion: `Remisión ${numero} anulada: ${motivo.trim()}`,
        },
      );
    });

    return this.findOne(numero);
  }
}
