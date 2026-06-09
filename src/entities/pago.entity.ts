import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Operario } from './operario.entity';
import { Vale } from './vale.entity';
import { Referencia } from './referencia.entity';

@Entity('pagos')
export class Pago {
  @PrimaryColumn()
  id: string; // e.g., PG-123456789

  @Column()
  fecha: string;

  @Column()
  operarioId: string;

  @ManyToOne(() => Operario, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operarioId' })
  operario: Operario;

  @Column()
  valeId: string;

  @ManyToOne(() => Vale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'valeId' })
  vale: Vale;

  @Column()
  etapa: string;

  @Column('int')
  pares: number;

  @Column('float')
  monto: number;

  @Column()
  refId: string;

  @ManyToOne(() => Referencia, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'refId' })
  referencia: Referencia;
}
