import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Persona del área administrativa: la que autoriza y da de alta los vales.
 *
 * Es un registro de PERSONA, no una cuenta de acceso — mismo criterio que
 * `Operario`. La cuenta (usuario + contraseña + rol) vive en `Usuario` y se
 * vincula por FK cuando estas personas tengan login propio.
 *
 * Se llama «administrativo» y no «administrador» a propósito: `Rol.ADMIN` ya
 * existe y significa otra cosa (quien manda en el sistema). Mezclar los dos
 * nombres es la forma más rápida de terminar sin saber qué permite cada uno.
 */
@Entity('administrativos')
export class Administrativo {
  @PrimaryColumn()
  id: string; // Formato ADM-XX

  @Column()
  nombre: string;

  @Column({ unique: true })
  correo: string;

  @Column({ type: 'varchar', nullable: true })
  cargo: string | null;

  @Column({ type: 'int', nullable: true })
  antiguedad: number | null;

  /**
   * Baja lógica. Un administrativo que ya autorizó vales NUNCA se borra: se
   * desactiva. Borrarlo dejaría vales sin responsable y rompería la trazabilidad
   * que es justamente el motivo de esta tabla.
   */
  @Column({ default: true })
  activo: boolean;
}
