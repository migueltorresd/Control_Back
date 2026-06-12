import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { ReferenciasRepository } from './referencias.repository';
import { MaterialesService } from '../materiales/materiales.service';
import { CreateReferenciaDto } from './dto/create-referencia.dto';
import { UpdateReferenciaDto } from './dto/update-referencia.dto';
import { Referencia } from './entities/referencia.entity';
import { Material } from '../materiales/entities/material.entity';

@Injectable()
export class ReferenciasService {
  constructor(
    private readonly repository: ReferenciasRepository,
    private readonly materialesService: MaterialesService,
    private readonly configService: ConfigService,
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
      | { material: Material; cantidad: number }[]
      | undefined = undefined;
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
    const referencia = await this.findOne(id);

    const uploadsDir = this.configService.get<string>('UPLOADS_DIR', './uploads');
    const referenciasDir = path.join(uploadsDir, 'referencias');
    if (!fs.existsSync(referenciasDir)) {
      fs.mkdirSync(referenciasDir, { recursive: true });
    }

    const ext =
      path.extname(file.originalname).substring(1).toLowerCase() || 'jpg';

    if (referencia.imagenExt && referencia.imagenExt !== ext) {
      const oldPath = path.join(referenciasDir, `${id}.${referencia.imagenExt}`);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (err) {
          console.error(`Error al borrar archivo viejo: ${oldPath}`, err);
        }
      }
    }

    const newPath = path.join(referenciasDir, `${id}.${ext}`);
    fs.writeFileSync(newPath, file.buffer);

    referencia.imagenExt = ext;
    return this.repository.save(referencia);
  }

  async getImagenPathAndMime(
    id: string,
  ): Promise<{ filePath: string; mimeType: string }> {
    const referencia = await this.findOne(id);
    if (!referencia.imagenExt) {
      throw new NotFoundException(
        `La referencia con ID ${id} no tiene imagen asociada`,
      );
    }

    const uploadsDir = this.configService.get<string>('UPLOADS_DIR', './uploads');
    const filePath = path.resolve(
      path.join(uploadsDir, 'referencias', `${id}.${referencia.imagenExt}`),
    );

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(
        `El archivo de imagen para la referencia ${id} no existe físicamente`,
      );
    }

    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const mimeType = mimeMap[referencia.imagenExt] || 'application/octet-stream';

    return { filePath, mimeType };
  }

  async deleteImagen(id: string): Promise<Referencia> {
    const referencia = await this.findOne(id);
    if (referencia.imagenExt) {
      const uploadsDir = this.configService.get<string>('UPLOADS_DIR', './uploads');
      const filePath = path.join(
        uploadsDir,
        'referencias',
        `${id}.${referencia.imagenExt}`,
      );
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Error al borrar archivo: ${filePath}`, err);
        }
      }
      referencia.imagenExt = null;
      return this.repository.save(referencia);
    }
    return referencia;
  }
}
