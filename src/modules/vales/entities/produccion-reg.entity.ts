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

  @Column('int')
  pares: number;

  @Column({
    type: 'varchar',
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
}
