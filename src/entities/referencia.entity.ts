import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('referencias')
export class Referencia {
  @PrimaryColumn()
  id: string;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  linea: string;

  @Column('float')
  precioVenta: number;

  @Column('jsonb', { default: {} })
  tarifas: Record<string, number>;

  @Column('jsonb', { default: {} })
  receta: Record<string, number>;
}
