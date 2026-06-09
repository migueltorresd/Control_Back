import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('operarios')
export class Operario {
  @PrimaryColumn()
  id: string;

  @Column()
  nombre: string;

  @Column()
  oficio: string;

  @Column({ type: 'int', nullable: true })
  antiguedad: number;
}
