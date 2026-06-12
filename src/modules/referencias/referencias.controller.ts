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
import { createReadStream } from 'fs';
import { ReferenciasService } from './referencias.service';
import { CreateReferenciaDto } from './dto/create-referencia.dto';
import { UpdateReferenciaDto } from './dto/update-referencia.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../auth/enums/rol.enum';
import { Public } from '../auth/decorators/public.decorator';

class CustomFileTypeValidator extends FileValidator<{ fileType: RegExp }> {
  constructor(validationOptions: { fileType: RegExp }) {
    super(validationOptions);
  }

  isValid(file: any): boolean {
    if (!file || !file.mimetype) return false;
    return this.validationOptions.fileType.test(file.mimetype);
  }

  buildErrorMessage(): string {
    return 'Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG y WEBP';
  }
}

@Controller('referencias')
@Roles(Rol.ADMIN)
export class ReferenciasController {
  constructor(private readonly referenciasService: ReferenciasService) {}

  @Get()
  async findAll() {
    const list = await this.referenciasService.findAll();
    return list.map((r) => this.mapToFrontend(r));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const ref = await this.referenciasService.findOne(id);
    return this.mapToFrontend(ref);
  }

  @Post()
  async save(@Body() dto: CreateReferenciaDto & { id?: string }) {
    let saved;
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
  @UseInterceptors(FileInterceptor('imagen'))
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
  async getImagen(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: any,
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
  async deleteImagen(@Param('id') id: string) {
    await this.referenciasService.deleteImagen(id);
    return { success: true };
  }

  private mapToFrontend(r: any) {
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


