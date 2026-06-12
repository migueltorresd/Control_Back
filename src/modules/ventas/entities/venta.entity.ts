import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Vale } from '../../vales/entities/vale.entity';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';

@Entity('ventas')
export class Venta {
  @PrimaryColumn()
  id: string; // e.g., VT-0001

  @Column()
  fecha: string; // YYYY-MM-DD

  @Column()
  valeId: string;

  @ManyToOne(() => Vale, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'valeId' })
  vale: Vale;

  @Column('int')
  pares: number;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  precioUnitario: number;
}
