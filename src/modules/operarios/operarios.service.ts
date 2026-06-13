import { Injectable, NotFoundException } from '@nestjs/common';
import { OperariosRepository } from './operarios.repository';
import { CreateOperarioDto } from './dto/create-operario.dto';
import { UpdateOperarioDto } from './dto/update-operario.dto';
import { Operario } from './entities/operario.entity';

@Injectable()
export class OperariosService {
  constructor(private readonly repository: OperariosRepository) {}

  async findAll(): Promise<Operario[]> {
    return this.repository.findAllOrderedById();
  }

  async findOne(id: string): Promise<Operario> {
    const operario = await this.repository.findById(id);
    if (!operario) {
      throw new NotFoundException(`Operario con ID ${id} no encontrado`);
    }
    return operario;
  }

  async create(dto: CreateOperarioDto): Promise<Operario> {
    const last = await this.repository.findLast();
    const lastNum = last ? parseInt(last.id.split('-')[1], 10) : 0;
    const nextId = 'OP-' + String(lastNum + 1).padStart(2, '0');

    return this.repository.createAndSave({
      id: nextId,
      nombre: dto.nombre,
      oficio: dto.oficio,
      antiguedad: dto.antiguedad,
    });
  }

  async update(id: string, dto: UpdateOperarioDto): Promise<Operario> {
    // Validar si existe antes de actualizar
    await this.findOne(id);

    const updated = await this.repository.updateOperario(id, dto);
    if (!updated) {
      throw new NotFoundException(
        `Operario con ID ${id} no se pudo actualizar`,
      );
    }
    return updated;
  }
}
