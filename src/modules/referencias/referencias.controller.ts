import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileValidator,
  StreamableFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { ReferenciasService } from './referencias.service';
import { Referencia } from './entities/referencia.entity';
import { CreateReferenciaDto } from './dto/create-referencia.dto';
import { UpdateReferenciaDto } from './dto/update-referencia.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { Public } from '../auth/decorators/public.decorator';

class CustomFileTypeValidator extends FileValidator<{ fileType: RegExp }> {
  constructor(validationOptions: { fileType: RegExp }) {
    super(validationOptions);
  }

  isValid(file: Express.Multer.File | undefined): boolean {
    if (!file || !file.mimetype) return false;
    return this.validationOptions.fileType.test(file.mimetype);
  }

  buildErrorMessage(): string {
    return 'Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG y WEBP';
  }
}

@ApiTags('Referencias / Modelos')
@ApiBearerAuth()
@Controller('referencias')
@Roles(Rol.ADMIN)
export class ReferenciasController {
  constructor(private readonly referenciasService: ReferenciasService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener todas las referencias / modelos de calzado (ADMIN)',
  })
  async findAll() {
    const list = await this.referenciasService.findAll();
    return list.map((r) => this.mapToFrontend(r));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una referencia específica por su ID (ADMIN)',
  })
  async findOne(@Param('id') id: string) {
    const ref = await this.referenciasService.findOne(id);
    return this.mapToFrontend(ref);
  }

  @Post()
  @ApiOperation({
    summary: 'Crear o actualizar una referencia / modelo (ADMIN)',
  })
  async save(@Body() dto: CreateReferenciaDto & { id?: string }) {
    let saved: Referencia;
    if (dto.id) {
      const { id, ...updateData } = dto;
      const updateDto: UpdateReferenciaDto = updateData;
      saved = await this.referenciasService.update(id, updateDto);
    } else {
      saved = await this.referenciasService.create(dto);
    }
    return this.mapToFrontend(saved);
  }

  @Post(':id/imagen')
  // limits corta el archivo en streaming si supera 5 MB, sin cargarlo entero a memoria
  @UseInterceptors(
    FileInterceptor('imagen', { limits: { fileSize: 1024 * 1024 * 5 } }),
  )
  @ApiOperation({ summary: 'Subir una imagen para la referencia (ADMIN)' })
  async uploadImagen(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 1024 * 1024 * 5,
            message: 'La imagen no debe superar los 5 MB',
          }),
          new CustomFileTypeValidator({
            fileType: /^image\/(jpeg|png|webp)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const saved = await this.referenciasService.uploadImagen(id, file);
    return this.mapToFrontend(saved);
  }

  @Get(':id/imagen')
  @Public()
  @ApiOperation({
    summary: 'Obtener el archivo de imagen de forma pública (Público)',
  })
  async getImagen(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: import('express').Response,
  ) {
    const { filePath, mimeType } =
      await this.referenciasService.getImagenPathAndMime(id);
    const fileStream = createReadStream(filePath);
    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=86400',
    });
    return new StreamableFile(fileStream);
  }

  @Delete(':id/imagen')
  @ApiOperation({
    summary: 'Eliminar la imagen asociada a la referencia (ADMIN)',
  })
  async deleteImagen(@Param('id') id: string) {
    await this.referenciasService.deleteImagen(id);
    return { success: true };
  }

  private mapToFrontend(r: Referencia) {
    return {
      id: r.id,
      nombre: r.nombre,
      linea: r.linea,
      precioVenta: Number(r.precioVenta),
      imagenExt: r.imagenExt,
      tieneImagen: !!r.imagenExt,
      tarifas: r.tarifas,
      receta: r.receta,
    };
  }
}
