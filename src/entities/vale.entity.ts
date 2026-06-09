import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Referencia } from './referencia.entity';

@Entity('vales')
export class Vale {
  @PrimaryColumn()
  vale: string;

  @Column()
  fecha: string;

  @Column()
  almacen: string;

  @Column()
  refId: string;

  @ManyToOne(() => Referencia, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'refId' })
  referencia: Referencia;

  @Column()
  color: string;

  @Column()
  altura: string;

  @Column('jsonb', { default: {} })
  tallas: Record<string, number>;
}
