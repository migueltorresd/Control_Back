import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Referencia } from './referencia.entity';
import { Material } from '../../materiales/entities/material.entity';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';

@Entity('receta_items')
export class RecetaItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Referencia, (ref) => ref.receta, { onDelete: 'CASCADE' })
  referencia: Referencia;

  @ManyToOne(() => Material, { onDelete: 'RESTRICT' })
  material: Material;

  @Column('decimal', { precision: 10, scale: 3, transformer: decimalTransformer })
  cantidad: number;
}
