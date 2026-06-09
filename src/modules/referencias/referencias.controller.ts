import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ReferenciasService } from './referencias.service';
import { CreateReferenciaDto } from './dto/create-referencia.dto';
import { UpdateReferenciaDto } from './dto/update-referencia.dto';

@Controller('referencias')
export class ReferenciasController {
  constructor(
    private readonly referenciasService: ReferenciasService,
  ) {}

  @Get()
  async findAll() {
    return this.referenciasService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.referenciasService.findOne(id);
  }

  @Post()
  async save(@Body() dto: CreateReferenciaDto & { id?: string }) {
    if (dto.id) {
      const { id, ...updateData } = dto;
      const updateDto: UpdateReferenciaDto = updateData;
      return this.referenciasService.update(id, updateDto);
    }
    return this.referenciasService.create(dto);
  }
}
