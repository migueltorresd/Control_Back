import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1781228207360 implements MigrationInterface {
    name = 'InitialSchema1781228207360'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "materiales" ("id" character varying NOT NULL, "nombre" character varying NOT NULL, "proveedor" character varying, "unidad" character varying NOT NULL, "precio" double precision NOT NULL, CONSTRAINT "PK_bdb2febb21ca2abcdd52ec12559" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "operarios" ("id" character varying NOT NULL, "nombre" character varying NOT NULL, "oficio" character varying NOT NULL, "antiguedad" integer, CONSTRAINT "PK_39fae8f788e11a394e056234fc5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tarifas" ("id" SERIAL NOT NULL, "oficio" character varying NOT NULL, "valor" numeric(12,2) NOT NULL, "referenciaId" character varying, CONSTRAINT "UQ_047123c56ebb7557ccf4ee543b5" UNIQUE ("referenciaId", "oficio"), CONSTRAINT "PK_a264af6b1739ea9368d9326e158" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "receta_items" ("id" SERIAL NOT NULL, "cantidad" numeric(10,3) NOT NULL, "referenciaId" character varying, "materialId" character varying, CONSTRAINT "PK_b1f884dd49ee0ee20895b914467" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "referencias" ("id" character varying NOT NULL, "nombre" character varying NOT NULL, "linea" character varying, "precioVenta" numeric(12,2) NOT NULL, CONSTRAINT "PK_3f100d163020c5d60503056a5e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "vale_tallas" ("id" SERIAL NOT NULL, "talla" integer NOT NULL, "cantidad" integer NOT NULL, "valeId" character varying, CONSTRAINT "PK_820ef6fc36f5ce5b5b4f0a809f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "produccion_registros" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "valeId" character varying NOT NULL, "etapa" character varying NOT NULL, "operarioId" character varying NOT NULL, "pares" integer NOT NULL, "estado" character varying NOT NULL DEFAULT 'registrado', "montoPagado" numeric(12,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_e634a4bfe18be77aa4e5c21cec4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "vales" ("vale" character varying NOT NULL, "fecha" character varying NOT NULL, "almacen" character varying NOT NULL, "color" character varying NOT NULL, "altura" character varying NOT NULL, "referenciaId" character varying NOT NULL, CONSTRAINT "PK_f1078ceb9eea23d015189ed35e0" PRIMARY KEY ("vale"))`);
        await queryRunner.query(`CREATE TABLE "pagos" ("id" character varying NOT NULL, "fecha" character varying NOT NULL, "operarioId" character varying NOT NULL, "valeId" character varying NOT NULL, "etapa" character varying NOT NULL, "pares" integer NOT NULL, "monto" numeric(12,2) NOT NULL, "refId" character varying NOT NULL, "produccionRegId" uuid, CONSTRAINT "PK_37321ca70a2ed50885dc205beb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ventas" ("id" character varying NOT NULL, "fecha" character varying NOT NULL, "valeId" character varying NOT NULL, "pares" integer NOT NULL, "precioUnitario" numeric(12,2) NOT NULL, CONSTRAINT "PK_b8b73abe8561829c019531d9a2e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "tarifas" ADD CONSTRAINT "FK_6b0bb3e1dfe41f3b355b1667f67" FOREIGN KEY ("referenciaId") REFERENCES "referencias"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "receta_items" ADD CONSTRAINT "FK_6ed3cac017f478fdb7689bcf2d1" FOREIGN KEY ("referenciaId") REFERENCES "referencias"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "receta_items" ADD CONSTRAINT "FK_4d7296c69b963f94ee6cfa8f1fa" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vale_tallas" ADD CONSTRAINT "FK_182235527caa105638c2e375b38" FOREIGN KEY ("valeId") REFERENCES "vales"("vale") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "produccion_registros" ADD CONSTRAINT "FK_cf041c0fea9d8adf3d6ef54be34" FOREIGN KEY ("valeId") REFERENCES "vales"("vale") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "produccion_registros" ADD CONSTRAINT "FK_ccf20b80c81f2602333905bb400" FOREIGN KEY ("operarioId") REFERENCES "operarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vales" ADD CONSTRAINT "FK_da70450e4afa06e8823d8f76d1b" FOREIGN KEY ("referenciaId") REFERENCES "referencias"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pagos" ADD CONSTRAINT "FK_a15d6caa2e087eeb057ac379bd5" FOREIGN KEY ("operarioId") REFERENCES "operarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pagos" ADD CONSTRAINT "FK_c95db9c81ba22ebb528f1d33508" FOREIGN KEY ("valeId") REFERENCES "vales"("vale") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pagos" ADD CONSTRAINT "FK_5f43118155d487768150c341eca" FOREIGN KEY ("refId") REFERENCES "referencias"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pagos" ADD CONSTRAINT "FK_1fc0d6b6795bc952b2c92a9eae8" FOREIGN KEY ("produccionRegId") REFERENCES "produccion_registros"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ventas" ADD CONSTRAINT "FK_1ae7dec2859b655f4aa7165b988" FOREIGN KEY ("valeId") REFERENCES "vales"("vale") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ventas" DROP CONSTRAINT "FK_1ae7dec2859b655f4aa7165b988"`);
        await queryRunner.query(`ALTER TABLE "pagos" DROP CONSTRAINT "FK_1fc0d6b6795bc952b2c92a9eae8"`);
        await queryRunner.query(`ALTER TABLE "pagos" DROP CONSTRAINT "FK_5f43118155d487768150c341eca"`);
        await queryRunner.query(`ALTER TABLE "pagos" DROP CONSTRAINT "FK_c95db9c81ba22ebb528f1d33508"`);
        await queryRunner.query(`ALTER TABLE "pagos" DROP CONSTRAINT "FK_a15d6caa2e087eeb057ac379bd5"`);
        await queryRunner.query(`ALTER TABLE "vales" DROP CONSTRAINT "FK_da70450e4afa06e8823d8f76d1b"`);
        await queryRunner.query(`ALTER TABLE "produccion_registros" DROP CONSTRAINT "FK_ccf20b80c81f2602333905bb400"`);
        await queryRunner.query(`ALTER TABLE "produccion_registros" DROP CONSTRAINT "FK_cf041c0fea9d8adf3d6ef54be34"`);
        await queryRunner.query(`ALTER TABLE "vale_tallas" DROP CONSTRAINT "FK_182235527caa105638c2e375b38"`);
        await queryRunner.query(`ALTER TABLE "receta_items" DROP CONSTRAINT "FK_4d7296c69b963f94ee6cfa8f1fa"`);
        await queryRunner.query(`ALTER TABLE "receta_items" DROP CONSTRAINT "FK_6ed3cac017f478fdb7689bcf2d1"`);
        await queryRunner.query(`ALTER TABLE "tarifas" DROP CONSTRAINT "FK_6b0bb3e1dfe41f3b355b1667f67"`);
        await queryRunner.query(`DROP TABLE "ventas"`);
        await queryRunner.query(`DROP TABLE "pagos"`);
        await queryRunner.query(`DROP TABLE "vales"`);
        await queryRunner.query(`DROP TABLE "produccion_registros"`);
        await queryRunner.query(`DROP TABLE "vale_tallas"`);
        await queryRunner.query(`DROP TABLE "referencias"`);
        await queryRunner.query(`DROP TABLE "receta_items"`);
        await queryRunner.query(`DROP TABLE "tarifas"`);
        await queryRunner.query(`DROP TABLE "operarios"`);
        await queryRunner.query(`DROP TABLE "materiales"`);
    }

}
