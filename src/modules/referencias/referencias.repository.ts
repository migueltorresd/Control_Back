import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Referencia } from './entities/referencia.entity';
import { Tarifa } from './entities/tarifa.entity';
import { RecetaItem } from './entities/receta-item.entity';
import { Material } from '../materiales/entities/material.entity';
import { Oficio } from '../../common/enums/oficio.enum';

@Injectable()
export class ReferenciasRepository extends Repository<Referencia> {
  constructor(private dataSource: DataSource) {
    super(Referencia, dataSource.createEntityManager());
  }

  async findAllWithRelations(): Promise<Referencia[]> {
    return this.find({
      relations: { tarifas: true, receta: { material: true } },
      order: { id: 'ASC' },
    });
  }

  async findByIdWithRelations(id: string): Promise<Referencia | null> {
    return this.findOne({
      where: { id },
      relations: { tarifas: true, receta: { material: true } },
    });
  }

  async findLast(): Promise<Referencia | null> {
    return this.findOne({ where: {}, order: { id: 'DESC' } });
  }

  async crearConRelaciones(
    refData: { id: string; nombre: string; linea?: string; precioVenta: number },
    tarifasData: { oficio: Oficio; valor: number }[],
    recetaItemsData: { material: Material; cantidad: number }[]
  ): Promise<Referencia> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Guardar Referencia
      const newRef = manager.create(Referencia, refData);
      const savedRef = await manager.save(Referencia, newRef);

      // 2. Guardar Tarifas
      if (tarifasData && tarifasData.length > 0) {
        const tarifas = tarifasData.map(t => manager.create(Tarifa, {
          ...t,
          referencia: savedRef
        }));
        await manager.save(Tarifa, tarifas);
      }

      // 3. Guardar RecetaItems
      if (recetaItemsData && recetaItemsData.length > 0) {
        const recetaItems = recetaItemsData.map(r => manager.create(RecetaItem, {
          ...r,
          referencia: savedRef
        }));
        await manager.save(RecetaItem, recetaItems);
      }

      // Retornar la referencia creada con sus relaciones
      const result = await manager.findOne(Referencia, {
        where: { id: savedRef.id },
        relations: { tarifas: true, receta: { material: true } }
      });
      return result!;
    });
  }

  async actualizarConRelaciones(
    id: string,
    refData: { nombre?: string; linea?: string; precioVenta?: number },
    tarifasData?: { oficio: Oficio; valor: number }[],
    recetaItemsData?: { material: Material; cantidad: number }[]
  ): Promise<Referencia | null> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Actualizar datos base de la referencia
      await manager.update(Referencia, id, refData);

      // 2. Si vienen tarifas, borrar anteriores e insertar nuevas
      if (tarifasData) {
        await manager.delete(Tarifa, { referencia: { id } });
        const reference = await manager.findOneBy(Referencia, { id });
        if (reference) {
          const tarifas = tarifasData.map(t => manager.create(Tarifa, {
            ...t,
            referencia: reference
          }));
          await manager.save(Tarifa, tarifas);
        }
      }

      // 3. Si viene receta, borrar anteriores e insertar nuevas
      if (recetaItemsData) {
        await manager.delete(RecetaItem, { referencia: { id } });
        const reference = await manager.findOneBy(Referencia, { id });
        if (reference) {
          const recetaItems = recetaItemsData.map(r => manager.create(RecetaItem, {
            ...r,
            referencia: reference
          }));
          await manager.save(RecetaItem, recetaItems);
        }
      }

      return manager.findOne(Referencia, {
        where: { id },
        relations: { tarifas: true, receta: { material: true } }
      });
    });
  }
}
