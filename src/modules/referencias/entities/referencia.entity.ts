import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { Tarifa } from './tarifa.entity';
import { RecetaItem } from './receta-item.entity';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';

@Entity('referencias')
export class Referencia {
  @PrimaryColumn()
  id: string; // Formato secuencial REF-XXX (3 dígitos)

  @Column()
  nombre: string;

  @Column({ nullable: true })
  linea: string;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  precioVenta: number;

  @OneToMany(() => Tarifa, (tarifa) => tarifa.referencia, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  tarifas: Tarifa[];

  @OneToMany(() => RecetaItem, (item) => item.referencia, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  receta: RecetaItem[];
}
