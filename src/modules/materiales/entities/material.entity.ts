import { Entity, Column, Index, PrimaryColumn } from 'typeorm';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';
import { TipoMaterial } from '../../../common/enums/tipo-material.enum';

@Entity('materiales')
export class Material {
  @PrimaryColumn()
  id: string;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  proveedor: string;

  @Column()
  unidad: string;

  /** NULL = todavía sin clasificar. No es lo mismo que `OTROS`. */
  @Index('IDX_materiales_tipo')
  @Column({ type: 'varchar', length: 20, nullable: true })
  tipo: TipoMaterial | null;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  precio: number;
}
