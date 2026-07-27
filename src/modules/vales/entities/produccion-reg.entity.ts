import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vale } from './vale.entity';
import { Operario } from '../../operarios/entities/operario.entity';
import { Oficio } from '../../../common/enums/oficio.enum';
import { EstadoProduccion } from '../../../common/enums/estado-produccion.enum';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';

@Entity('produccion_registros')
export class ProduccionReg {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  valeId: string;

  @ManyToOne(() => Vale, (vale) => vale.produccion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'valeId' })
  vale: Vale;

  @Column({ type: 'varchar' })
  etapa: Oficio;

  @Column()
  operarioId: string;

  @ManyToOne(() => Operario, { onDelete: 'RESTRICT' }) // Restringe el borrado de operarios con producción registrada
  @JoinColumn({ name: 'operarioId' })
  operario: Operario;

  /**
   * Null mientras el registro sea solo una asignación (estado ASIGNADO): se
   * sabe quién hace la etapa pero todavía no cuántos pares hizo.
   */
  @Column({ type: 'int', nullable: true })
  pares: number | null;

  @Column({
    type: 'enum',
    enum: EstadoProduccion,
    default: EstadoProduccion.REGISTRADO,
  })
  estado: EstadoProduccion;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  montoPagado: number;

  @Column({ type: 'varchar', nullable: true })
  revisadoPor: string | null;

  @Column({ type: 'timestamp', nullable: true })
  revisadoEn: Date | null;
}
