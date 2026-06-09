import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Vale } from './vale.entity';
import { Referencia } from './referencia.entity';

@Entity('ventas')
export class Venta {
  @PrimaryColumn()
  id: string; // e.g., VT-123456789

  @Column()
  fecha: string;

  @Column()
  valeId: string;

  @ManyToOne(() => Vale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'valeId' })
  vale: Vale;

  @Column()
  refId: string;

  @ManyToOne(() => Referencia, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'refId' })
  referencia: Referencia;

  @Column()
  color: string;

  @Column('int')
  pares: number;

  @Column('float')
  precio: number;

  @Column('float')
  monto: number;
}
