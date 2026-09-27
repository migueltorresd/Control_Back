import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

/**
 * Cliente al que se le remite mercancía.
 *
 * Existe para que el cliente sea UNO solo aunque su nombre se escriba de
 * cinco maneras. Antes el nombre era texto libre repetido en cada remisión,
 * así que «OMAR BERMUDEZ» y «Omar Bermúdez» eran dos deudores distintos y la
 * cartera mostraba la deuda partida en dos.
 *
 * Ojo con lo que NO hace: la remisión sigue guardando el nombre, el documento
 * y la dirección con los que se emitió. Este registro dice quién es el cliente
 * HOY; la remisión dice qué decía el papel que se firmó ese día. Si el cliente
 * se muda, la remisión vieja tiene que seguir mostrando la dirección a la que
 * realmente se despachó.
 */
@Entity('clientes')
export class Cliente {
  @PrimaryColumn()
  id: string; // Formato CLI-0001

  /**
   * Único ignorando tildes, puntuación, mayúsculas y espacios de más — el
   * índice que lo garantiza vive en la migración, porque es una expresión de
   * Postgres y no algo que TypeORM sepa declarar.
   */
  @Column()
  nombre: string;

  /** NIT o cédula. Opcional, pero si está no puede repetirse. */
  @Column({ type: 'varchar', nullable: true })
  documento: string | null;

  @Column({ type: 'varchar', nullable: true })
  direccion: string | null;

  /** Para cobrar. En la práctica es el dato más útil de esta tabla. */
  @Column({ type: 'varchar', nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', nullable: true })
  correo: string | null;

  /**
   * Baja lógica. Un cliente con remisiones emitidas NUNCA se borra: se
   * desactiva. Borrarlo dejaría documentos entregados sin destinatario y
   * haría desaparecer su cartera. Mismo criterio que operarios y
   * administrativos.
   */
  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
