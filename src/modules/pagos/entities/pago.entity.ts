import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Operario } from '../../operarios/entities/operario.entity';
import { Vale } from '../../vales/entities/vale.entity';
import { Referencia } from '../../referencias/entities/referencia.entity';
import { ProduccionReg } from '../../vales/entities/produccion-reg.entity';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';

@Entity('pagos')
export class Pago {
  @PrimaryColumn()
  id: string; // ej., PG-123456789

  @Column()
  fecha: string;

  @Column()
  operarioId: string;

  @ManyToOne(() => Operario, { onDelete: 'CASCADE' })
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

  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer })
  monto: number;

  @Column()
  refId: string;

  @ManyToOne(() => Referencia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'refId' })
  referencia: Referencia;

  // Relación nullable para vincular el pago con el registro de producción
  @Column({ nullable: true })
  produccionRegId: string;

  @ManyToOne(() => ProduccionReg, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'produccionRegId' })
  produccionReg: ProduccionReg;
}
