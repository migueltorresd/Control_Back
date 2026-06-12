import { Injectable, NotFoundException } from '@nestjs/common';
import { VentasRepository } from './ventas.repository';
import { ValesService } from '../vales/vales.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { UpdateVentaDto } from './dto/update-venta.dto';
import { Venta } from './entities/venta.entity';

@Injectable()
export class VentasService {
  constructor(
    private readonly repository: VentasRepository,
    private readonly valesService: ValesService,
  ) {}

  async findAll(): Promise<Venta[]> {
    return this.repository.findAllWithRelations();
  }

  async findOne(id: string): Promise<Venta> {
    const venta = await this.repository.findByIdWithRelations(id);
    if (!venta) {
      throw new NotFoundException(`Venta con ID ${id} no encontrada`);
    }
    return venta;
  }

  async create(dto: CreateVentaDto): Promise<Venta> {
    // 1. Validar que el vale exista
    await this.valesService.findOne(dto.valeId);

    // 2. Establecer fecha por defecto si no viene
    const fecha = dto.fecha || new Date().toISOString().split('T')[0];

    // 3. Crear y guardar (el ID lo genera la secuencia ventas_seq)
    const saved = await this.repository.createAndSave({
      valeId: dto.valeId,
      pares: dto.pares,
      precioUnitario: dto.precioUnitario,
      fecha,
    });

    // 4. Retornar la venta completa con sus relaciones cargadas
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateVentaDto): Promise<Venta> {
    // 1. Validar que la venta exista
    const venta = await this.findOne(id);

    // 2. Validar que el vale exista si se está actualizando
    if (dto.valeId) {
      await this.valesService.findOne(dto.valeId);
    }

    // 3. Actualizar campos
    if (dto.valeId !== undefined) venta.valeId = dto.valeId;
    if (dto.pares !== undefined) venta.pares = dto.pares;
    if (dto.precioUnitario !== undefined)
      venta.precioUnitario = dto.precioUnitario;
    if (dto.fecha !== undefined) venta.fecha = dto.fecha;

    await this.repository.save(venta);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const venta = await this.findOne(id);
    await this.repository.remove(venta);
  }
}
