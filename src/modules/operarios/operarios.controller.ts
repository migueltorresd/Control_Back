import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { OperariosService } from './operarios.service';
import { CreateOperarioDto } from './dto/create-operario.dto';
import { UpdateOperarioDto } from './dto/update-operario.dto';

@Controller('operarios')
export class OperariosController {
  constructor(
    private readonly operariosService: OperariosService,
  ) {}

  @Get()
  async findAll() {
    return this.operariosService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.operariosService.findOne(id);
  }

  @Post()
  async save(@Body() dto: CreateOperarioDto & { id?: string }) {
    if (dto.id) {
      const { id, ...updateData } = dto;
      const updateDto: UpdateOperarioDto = updateData;
      return this.operariosService.update(id, updateDto);
    }
    return this.operariosService.create(dto);
  }
}
