import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Remision } from '../../remisiones/entities/remision.entity';
import { Administrativo } from '../../administrativos/entities/administrativo.entity';
import { MetodoAbono } from '../../../common/enums/metodo-abono.enum';
import { EstadoDocumento } from '../../../common/enums/estado-documento.enum';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';

/**
 * Un pago parcial o total del cliente contra una remisión a crédito.
 *
 * Es la plata que ENTRA. No confundir con `Pago`, que es la que sale hacia los
 * operarios: sumarlas en el mismo lugar haría que cualquier cuenta de caja
 * mintiera por el doble.
 *
 * El saldo de la remisión no vive acá ni allá: se calcula como
 * `total - suma de abonos vigentes` cada vez que se pide.
 */
@Entity('abonos')
export class Abono {
  /** Consecutivo, ej. `AB-0001`. Lo da la secuencia, no la app. */
  @PrimaryColumn()
  id: string;

  @Index()
  @Column()
  remisionId: string;

  @ManyToOne(() => Remision, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'remisionId' })
  remision: Remision;

  @Column({ type: 'date' })
  fecha: string; // YYYY-MM-DD

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  monto: number;

  @Column({ type: 'varchar', length: 20 })
  metodo: MetodoAbono;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ type: 'varchar', nullable: true })
  registradoPorId: string | null;

  @ManyToOne(() => Administrativo, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'registradoPorId' })
  registradoPor: Administrativo | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  /**
   * Un abono anulado deja de contar contra el saldo: la deuda vuelve a subir.
   * No se borra, porque hay que poder ver que alguien lo registró y lo deshizo.
   */
  @Index()
  @Column({ type: 'varchar', length: 20, default: EstadoDocumento.ACTIVO })
  estado: EstadoDocumento;

  @Column({ type: 'timestamptz', nullable: true })
  anuladoEn: Date | null;

  @Column({ type: 'varchar', nullable: true })
  anuladoPorId: string | null;

  @ManyToOne(() => Administrativo, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'anuladoPorId' })
  anuladoPor: Administrativo | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  motivoAnulacion: string | null;
}
