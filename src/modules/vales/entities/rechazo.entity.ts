import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Vale } from './vale.entity';
import { Operario } from '../../operarios/entities/operario.entity';
import { Oficio } from '../../../common/enums/oficio.enum';
import { ProduccionReg } from './produccion-reg.entity';

@Entity('rechazos')
export class Rechazo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column()
  valeId: string;

  @ManyToOne(() => Vale, (vale) => vale.rechazos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'valeId' })
  vale: Vale;

  @Column({ type: 'varchar' })
  etapa: Oficio;

  @Column()
  operarioId: string;

  @ManyToOne(() => Operario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operarioId' })
  operario: Operario;

  @Column('int')
  pares: number;

  @Column({ type: 'varchar', length: 200 })
  motivo: string;

  @Column({ nullable: true })
  registroId: string | null;

  @ManyToOne(() => ProduccionReg, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'registroId' })
  registro: ProduccionReg | null;

  @CreateDateColumn({ type: 'timestamp' })
  creadoEn: Date;
}
