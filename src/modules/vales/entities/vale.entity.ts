import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Referencia } from '../../referencias/entities/referencia.entity';
import { Administrativo } from '../../administrativos/entities/administrativo.entity';
import { EstadoVale } from '../../../common/enums/estado-vale.enum';
import { ValeTalla } from './vale-talla.entity';
import { ProduccionReg } from './produccion-reg.entity';
import { Rechazo } from './rechazo.entity';

@Entity('vales')
export class Vale {
  // Mapeado a la columna 'vale' para compatibilidad con la base de datos PostgreSQL existente
  @PrimaryColumn({ name: 'vale' })
  id: string; // Formato secuencial V-XXXX (4 dígitos)

  @Column({ type: 'date' })
  fecha: string;

  /**
   * Instante exacto del alta. `fecha` es solo el día (type 'date'), así que la
   * hora no existía en el sistema: esta columna la agrega.
   *
   * Nullable porque los vales anteriores a la columna no tienen hora que
   * recuperar — poner la de la migración sería inventar un dato.
   */
  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  creadoEn: Date | null;

  @Column()
  almacen: string;

  @Column()
  color: string;

  @Column({ type: 'varchar', nullable: true })
  altura: string | null;

  @Column()
  referenciaId: string;

  @ManyToOne(() => Referencia, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'referenciaId' })
  referencia: Referencia;

  /**
   * Administrativo que dio de alta y autoriza el vale.
   *
   * Nullable porque los vales anteriores a esta tabla no tienen a quién
   * atribuirse. Cuando el área administrativa tenga login propio, este campo
   * pasará a llenarse solo desde el usuario autenticado en vez de elegirse a
   * mano en un selector.
   */
  @Column({ type: 'varchar', nullable: true })
  creadoPorId: string | null;

  @ManyToOne(() => Administrativo, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'creadoPorId' })
  creadoPor: Administrativo | null;

  /**
   * Vigente o anulado. Un vale nunca se borra — ver EstadoVale.
   *
   * `varchar` y no `enum` de Postgres a propósito: agregar un valor a un tipo
   * enum en la base exige otra migración, y este estado puede crecer.
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: EstadoVale.ACTIVO,
  })
  estado: EstadoVale;

  /**
   * Última edición del vale. Es una caché para pintar la ficha sin joins: el
   * historial completo (antes/después de cada campo, y el usuario autenticado
   * que lo hizo) vive en `auditorias`.
   */
  @Column({ type: 'timestamptz', nullable: true })
  modificadoEn: Date | null;

  @Column({ type: 'varchar', nullable: true })
  modificadoPorId: string | null;

  @ManyToOne(() => Administrativo, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'modificadoPorId' })
  modificadoPor: Administrativo | null;

  @Column({ type: 'timestamptz', nullable: true })
  anuladoEn: Date | null;

  @Column({ type: 'varchar', nullable: true })
  anuladoPorId: string | null;

  @ManyToOne(() => Administrativo, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'anuladoPorId' })
  anuladoPor: Administrativo | null;

  /** Por qué se anuló. Obligatorio en la API, nullable acá: los vigentes no tienen. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  motivoAnulacion: string | null;

  @OneToMany(() => ValeTalla, (vt) => vt.vale, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  tallas: ValeTalla[];

  @OneToMany(() => ProduccionReg, (pr) => pr.vale, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  produccion: ProduccionReg[];

  @OneToMany(() => Rechazo, (r) => r.vale)
  rechazos: Rechazo[];
}
