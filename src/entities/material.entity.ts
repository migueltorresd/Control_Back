import { Entity, Column, PrimaryColumn } from 'typeorm';

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

  @Column('float')
  precio: number;
}
