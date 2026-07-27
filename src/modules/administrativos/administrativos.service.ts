import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AdministrativosRepository } from './administrativos.repository';
import { CreateAdministrativoDto } from './dto/create-administrativo.dto';
import { UpdateAdministrativoDto } from './dto/update-administrativo.dto';
import { Administrativo } from './entities/administrativo.entity';

@Injectable()
export class AdministrativosService {
  constructor(private readonly repository: AdministrativosRepository) {}

  async findAll(soloActivos = false): Promise<Administrativo[]> {
    return soloActivos
      ? this.repository.findActivos()
      : this.repository.findAllOrderedById();
  }

  async findOne(id: string): Promise<Administrativo> {
    const administrativo = await this.repository.findById(id);
    if (!administrativo) {
      throw new NotFoundException(`Administrativo con ID ${id} no encontrado`);
    }
    return administrativo;
  }

  /**
   * Valida que el administrativo exista y esté activo antes de asociarlo a un
   * vale. Un vale nuevo no puede quedar a nombre de alguien dado de baja.
   */
  async assertSeleccionable(id: string): Promise<Administrativo> {
    const administrativo = await this.findOne(id);
    if (!administrativo.activo) {
      throw new BadRequestException(
        `El administrativo ${id} está inactivo y no puede autorizar vales`,
      );
    }
    return administrativo;
  }

  async create(dto: CreateAdministrativoDto): Promise<Administrativo> {
    await this.assertCorreoLibre(dto.correo);

    const last = await this.repository.findLast();
    const lastNum = last ? parseInt(last.id.split('-')[1], 10) : 0;
    const nextId = 'ADM-' + String(lastNum + 1).padStart(2, '0');

    return this.repository.createAndSave({
      id: nextId,
      nombre: dto.nombre,
      correo: dto.correo,
      cargo: dto.cargo ?? null,
      antiguedad: dto.antiguedad ?? null,
      activo: dto.activo ?? true,
    });
  }

  async update(
    id: string,
    dto: UpdateAdministrativoDto,
  ): Promise<Administrativo> {
    const actual = await this.findOne(id);

    if (dto.correo && dto.correo !== actual.correo) {
      await this.assertCorreoLibre(dto.correo);
    }

    const updated = await this.repository.updateAdministrativo(id, dto);
    if (!updated) {
      throw new NotFoundException(
        `Administrativo con ID ${id} no se pudo actualizar`,
      );
    }
    return updated;
  }

  private async assertCorreoLibre(correo: string): Promise<void> {
    const existente = await this.repository.findByCorreo(correo);
    if (existente) {
      throw new ConflictException(
        `Ya existe un administrativo con el correo ${correo}`,
      );
    }
  }
}
