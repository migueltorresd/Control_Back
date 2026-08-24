import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Administrativo } from '../../administrativos/entities/administrativo.entity';
import { EstadoDocumento } from '../../../common/enums/estado-documento.enum';
import { Vale } from '../../vales/entities/vale.entity';
import { Remision } from '../../remisiones/entities/remision.entity';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';

@Entity('ventas')
export class Venta {
  @PrimaryColumn()
  id: string; // e.g., VT-0001

  @Column({ type: 'date' })
  fecha: string; // YYYY-MM-DD

  @Column()
  valeId: string;

  @ManyToOne(() => Vale, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'valeId' })
  vale: Vale;

  @Column('int')
  pares: number;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  precioUnitario: number;

  /**
   * Remisión que ampara esta salida, si la hay.
   *
   * Nullable porque una venta puede registrarse suelta, y porque las que ya
   * existían se hicieron antes de que el documento existiera: inventarles una
   * remisión sería afirmar que se emitió un papel que nadie firmó.
   */
  @Column({ type: 'varchar', nullable: true })
  remisionId: string | null;

  @ManyToOne(() => Remision, (remision) => remision.items, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'remisionId' })
  remision: Remision | null;

  /**
   * Estado del documento. Una venta anulada no descuenta stock: los
   * pares vuelven a estar disponibles, pero queda el rastro de la salida.
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
