import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Referencia } from '../../referencias/entities/referencia.entity';
import { ValeTalla } from './vale-talla.entity';
import { ProduccionReg } from './produccion-reg.entity';
import { Rechazo } from './rechazo.entity';

@Entity('vales')
export class Vale {
  // Mapeado a la columna 'vale' para compatibilidad con la base de datos PostgreSQL existente
  @PrimaryColumn({ name: 'vale' })
  id: string; // Formato secuencial V-XXXX (4 dígitos)

  @Column()
  fecha: string;

  @Column()
  almacen: string;

  @Column()
  color: string;

  @Column()
  altura: string;

  @Column()
  referenciaId: string;

  @ManyToOne(() => Referencia, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'referenciaId' })
  referencia: Referencia;

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
