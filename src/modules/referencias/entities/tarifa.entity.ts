import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Referencia } from './referencia.entity';
import { Oficio } from '../../../common/enums/oficio.enum';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';

@Entity('tarifas')
@Unique(['referencia', 'oficio']) // Restricción única compuesta
export class Tarifa {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Referencia, (ref) => ref.tarifas, { onDelete: 'CASCADE' })
  referencia: Referencia;

  @Column({ type: 'varchar' })
  oficio: Oficio;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  valor: number;
}
