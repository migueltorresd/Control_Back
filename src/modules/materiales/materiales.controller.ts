import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { MaterialesService } from './materiales.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

@Controller('materiales')
export class MaterialesController {
  constructor(private readonly materialesService: MaterialesService) {}

  @Get()
  async findAll() {
    return this.materialesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.materialesService.findOne(id);
  }

  @Post()
  async save(@Body() dto: CreateMaterialDto & { id?: string }) {
    if (dto.id) {
      const { id, ...updateData } = dto;
      // Mapeamos a UpdateMaterialDto
      const updateDto: UpdateMaterialDto = updateData;
      return this.materialesService.update(id, updateDto);
    }
    return this.materialesService.create(dto);
  }
}
