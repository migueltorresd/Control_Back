import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ReferenciasRepository } from './referencias.repository';
import { MaterialesService } from '../materiales/materiales.service';
import { CreateReferenciaDto } from './dto/create-referencia.dto';
import { UpdateReferenciaDto } from './dto/update-referencia.dto';
import { Referencia } from './entities/referencia.entity';
import { Material } from '../materiales/entities/material.entity';
import {
  MIME_A_EXT,
  tieneFirmaDeImagen,
} from '../../common/utils/image-validation.util';

@Injectable()
export class ReferenciasService {
  constructor(
    private readonly repository: ReferenciasRepository,
    private readonly materialesService: MaterialesService,
  ) {}

  async findAll(): Promise<Referencia[]> {
    return this.repository.findAllWithRelations();
  }

  async findOne(id: string): Promise<Referencia> {
    const referencia = await this.repository.findByIdWithRelations(id);
    if (!referencia) {
      throw new NotFoundException(`Referencia con ID ${id} no encontrada`);
    }
    return referencia;
  }

  async create(dto: CreateReferenciaDto): Promise<Referencia> {
    // 1. Validar que cada materialId de la receta exista en el módulo de materiales
    const recetaConEntidades: { material: Material; cantidad: number }[] = [];
    for (const item of dto.receta) {
      const material = await this.materialesService.findOne(item.materialId);
      recetaConEntidades.push({
        material,
        cantidad: item.cantidad,
      });
    }

    // 2. Generar el ID secuencial REF-XXX (3 dígitos)
    const last = await this.repository.findLast();
    const lastNum = last ? parseInt(last.id.split('-')[1], 10) : 0;
    const nextId = 'REF-' + String(lastNum + 1).padStart(3, '0');

    // 3. Guardar la referencia de forma atómica a través del repositorio
    return this.repository.crearConRelaciones(
      {
        id: nextId,
        nombre: dto.nombre,
        linea: dto.linea,
        precioVenta: dto.precioVenta,
      },
      dto.tarifas,
      recetaConEntidades,
    );
  }

  async update(id: string, dto: UpdateReferenciaDto): Promise<Referencia> {
    // Validar si existe antes de proceder
    await this.findOne(id);

    // Si se está actualizando la receta, validar que los nuevos materiales existan
    let recetaConEntidades:
      { material: Material; cantidad: number }[] | undefined = undefined;
    if (dto.receta) {
      recetaConEntidades = [];
      for (const item of dto.receta) {
        const material = await this.materialesService.findOne(item.materialId);
        recetaConEntidades.push({
          material,
          cantidad: item.cantidad,
        });
      }
    }

    const updated = await this.repository.actualizarConRelaciones(
      id,
      {
        nombre: dto.nombre,
        linea: dto.linea,
        precioVenta: dto.precioVenta,
      },
      dto.tarifas,
      recetaConEntidades,
    );

    if (!updated) {
      throw new NotFoundException(
        `Referencia con ID ${id} no se pudo actualizar`,
      );
    }
    return updated;
  }

  async uploadImagen(
    id: string,
    file: Express.Multer.File,
  ): Promise<Referencia> {
    await this.findOne(id);

    // La extensión la decide el SERVIDOR a partir del mimetype validado por el
    // ParseFilePipe — nunca el nombre del archivo del cliente (que podría ser
    // ".php", ".svg", etc.).
    const ext = MIME_A_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Tipo de imagen no permitido (solo JPG, PNG o WEBP)',
      );
    }

    // Verificación de contenido real (magic bytes): el mimetype lo declara el
    // cliente; esto confirma que el archivo es de verdad la imagen que dice ser.
    if (!tieneFirmaDeImagen(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'El archivo no es una imagen válida o está dañado',
      );
    }

    return this.repository.guardarImagen(id, ext, file.buffer);
  }

  async getImagen(id: string): Promise<{
    datos: Buffer;
    mimeType: string;
    actualizadoEn: Date;
  }> {
    const referencia = await this.findOne(id);
    if (!referencia.imagenExt) {
      throw new NotFoundException(
        `La referencia con ID ${id} no tiene imagen asociada`,
      );
    }

    const imagen = await this.repository.obtenerImagen(id);
    if (!imagen) {
      throw new NotFoundException(
        `La imagen de la referencia ${id} no existe en la base de datos`,
      );
    }

    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const mimeType =
      mimeMap[referencia.imagenExt] || 'application/octet-stream';

    return {
      datos: imagen.datos,
      mimeType,
      actualizadoEn: imagen.actualizadoEn,
    };
  }

  async deleteImagen(id: string): Promise<Referencia> {
    const referencia = await this.findOne(id);
    if (!referencia.imagenExt) {
      return referencia;
    }
    return this.repository.borrarImagen(id);
  }
}
