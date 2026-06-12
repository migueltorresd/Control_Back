import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('auditorias')
export class Auditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  fecha: Date;

  @Column({ type: 'varchar' })
  usuario: string;

  @Column({ type: 'varchar' })
  accion: string; // 'PAGAR', 'ANULAR_PAGO', 'APROBAR_PRODUCCION', 'REVERTIR_PRODUCCION', 'ELIMINAR_REGISTRO'

  @Column({ type: 'varchar' })
  entidad: string;

  @Column({ type: 'varchar' })
  entidadId: string;

  @Column({ type: 'jsonb' })
  detalle: Record<string, any>;
}
