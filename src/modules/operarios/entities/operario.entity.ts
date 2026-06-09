import { Entity, Column, PrimaryColumn } from 'typeorm';
import { Oficio } from '../../../common/enums/oficio.enum';

@Entity('operarios')
export class Operario {
  @PrimaryColumn()
  id: string;

  @Column()
  nombre: string;

  @Column({ type: 'varchar' })
  oficio: Oficio;

  @Column({ type: 'int', nullable: true })
  antiguedad: number;
}
