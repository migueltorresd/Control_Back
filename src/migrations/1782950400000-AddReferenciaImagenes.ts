import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mueve el almacenamiento de imágenes de modelos del disco del servidor a la
 * base de datos. En hosting con filesystem efímero (Render) los archivos en
 * disco se pierden en cada deploy; en la BD persisten y entran en el pg_dump.
 *
 * Las imágenes que existieran solo en disco no se migran automáticamente:
 * hay que volver a subirlas desde Ajustes. Se limpia `imagenExt` para que el
 * frontend muestre "Sin imagen" en vez de una imagen rota.
 */
export class AddReferenciaImagenes1782950400000 implements MigrationInterface {
  name = 'AddReferenciaImagenes1782950400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "referencia_imagenes" (
        "referenciaId" character varying NOT NULL,
        "datos" bytea NOT NULL,
        "actualizadoEn" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referencia_imagenes" PRIMARY KEY ("referenciaId"),
        CONSTRAINT "FK_referencia_imagenes_referencia" FOREIGN KEY ("referenciaId")
          REFERENCES "referencias"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `UPDATE "referencias" SET "imagenExt" = NULL WHERE "imagenExt" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "referencia_imagenes"`);
  }
}
