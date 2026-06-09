import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Vale } from './vale.entity';

@Entity('vale_tallas')
export class ValeTalla {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vale, (vale) => vale.tallas, { onDelete: 'CASCADE' })
  vale: Vale;

  @Column('int')
  talla: number;

  @Column('int')
  cantidad: number;
}
