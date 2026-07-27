import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Operario } from '../../operarios/entities/operario.entity';
import { Rol } from '../enums/rol.enum';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar' })
  rol: Rol;

  // Preparado para el acceso futuro de operarios: vincula la cuenta con su registro
  @Column({ type: 'varchar', nullable: true })
  operarioId: string | null;

  @ManyToOne(() => Operario, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'operarioId' })
  operario: Operario | null;

  @Column({ default: true })
  activo: boolean;

  // Versión de sesión: viaja dentro del JWT y se compara contra la BD en cada
  // request. Incrementarla (p. ej. al cambiar la contraseña) invalida al
  // instante todos los tokens emitidos antes.
  @Column({ default: 0 })
  tokenVersion: number;
}
