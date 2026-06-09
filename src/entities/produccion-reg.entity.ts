import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Vale } from './vale.entity';
import { Operario } from './operario.entity';

@Entity('produccion_registros')
export class ProduccionReg {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  valeId: string;

  @ManyToOne(() => Vale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'valeId' })
  vale: Vale;

  @Column()
  etapa: string;

  @Column()
  operarioId: string;

  @ManyToOne(() => Operario, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operarioId' })
  operario: Operario;

  @Column('int')
  pares: number;

  @Column({ default: 'registrado' })
  estado: string; // 'registrado' | 'aprobado' | 'pagado'
}
