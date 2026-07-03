import { Entity, Column, PrimaryColumn, OneToOne, JoinColumn } from 'typeorm';
import { Referencia } from './referencia.entity';

/**
 * Binario de la imagen del modelo, separado de `referencias` para que los
 * SELECT del catálogo nunca arrastren megas de bytea. La extensión/mime vive
 * en `referencias.imagenExt` (es lo que el frontend usa como `tieneImagen`).
 */
@Entity('referencia_imagenes')
export class ReferenciaImagen {
  @PrimaryColumn()
  referenciaId: string;

  @OneToOne(() => Referencia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referenciaId' })
  referencia: Referencia;

  @Column({ type: 'bytea' })
  datos: Buffer;

  // Alimenta el ETag del endpoint público de imagen (revalidación barata).
  @Column({ type: 'timestamptz', default: () => 'now()' })
  actualizadoEn: Date;
}
