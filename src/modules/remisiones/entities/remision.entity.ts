import {
  Entity,
  Column,
  PrimaryColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Administrativo } from '../../administrativos/entities/administrativo.entity';
import { Cliente } from '../../clientes/entities/cliente.entity';
import { EstadoDocumento } from '../../../common/enums/estado-documento.enum';
import { Venta } from '../../ventas/entities/venta.entity';
import { FormaPago } from '../../../common/enums/forma-pago.enum';

/**
 * Remisión: el papel que acompaña la mercancía cuando sale del taller.
 *
 * Guarda solo la cabecera —a quién, cómo paga y con qué número—. Sus renglones
 * son las ventas que le cuelgan por `remisionId`: la venta ya tenía vale, pares
 * y precio unitario, que es exactamente lo que pide cada línea del talonario.
 *
 * No se duplica nada a propósito. El stock sale de `fabricados - vendidos`, así
 * que si la remisión tuviera renglones propios habría dos caminos sacando pares
 * del depósito y tarde o temprano dirían cosas distintas.
 */
@Entity('remisiones')
export class Remision {
  /** Consecutivo del talonario, ej. `REM-0151`. Lo da la secuencia, no la app. */
  @PrimaryColumn()
  numero: string;

  @Column({ type: 'date' })
  fecha: string; // YYYY-MM-DD

  /**
   * Quién es el cliente, contra el catálogo. Es lo que agrupa la cartera:
   * por id no hay forma de que un mismo cliente aparezca dos veces por haber
   * escrito el nombre distinto.
   *
   * Nullable porque las remisiones anteriores al catálogo pudieron quedar sin
   * vincular, y porque el documento vale por sí mismo aunque el cliente se
   * borrara del catálogo.
   */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  clienteId: string | null;

  @ManyToOne(() => Cliente, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'clienteId' })
  cliente: Cliente | null;

  /**
   * Los tres campos siguientes son una FOTO del cliente al emitir, no un
   * reflejo del catálogo.
   *
   * Es a propósito y no es dato duplicado: la remisión es el documento que el
   * cliente firmó. Si mañana se muda y se corrige su dirección en el catálogo,
   * esta remisión tiene que seguir diciendo a dónde se despachó de verdad, o
   * el PDF reimpreso dejaría de coincidir con el papel firmado.
   */
  @Column({ length: 160 })
  clienteNombre: string;

  /** C.C. o NIT. Opcional: al mostrador no siempre se pide. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  clienteDocumento: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  clienteDireccion: string | null;

  @Column({ type: 'varchar', length: 20 })
  formaPago: FormaPago;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  /** Los renglones del documento. Son ventas, no una tabla aparte. */
  @OneToMany(() => Venta, (venta) => venta.remision)
  items: Venta[];

  /**
   * Estado del documento. Una remisión anulada no descuenta stock: los
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
