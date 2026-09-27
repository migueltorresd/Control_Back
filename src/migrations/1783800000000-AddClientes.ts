import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Misma normalización que usa la cartera para agrupar nombres escritos
 * distinto. Va repetida aquí a propósito: una migración tiene que poder
 * ejecutarse igual dentro de diez años aunque el código de la aplicación haya
 * cambiado. Si importara la constante del servicio, un refactor futuro
 * cambiaría el resultado de una migración ya aplicada.
 */
const CLAVE = (col: string) => `upper(
  regexp_replace(
    translate(btrim(${col}), 'áéíóúÁÉÍÓÚñÑüÜ.,', 'aeiouAEIOUnNuU'),
    '[[:space:]]+', ' ', 'g'
  )
)`;

/**
 * Catálogo de clientes + vínculo desde las remisiones.
 *
 * Hasta ahora el cliente era texto libre repetido en cada remisión, así que
 * «OMAR BERMUDEZ» y «Omar Bermúdez» eran dos personas para la base. Esta
 * migración crea la identidad real y engancha el histórico.
 *
 * La remisión NO deja de guardar el nombre, el documento y la dirección: son
 * el documento que el cliente firmó y no pueden cambiar porque después se
 * corrija el catálogo. `clienteId` responde «quién es» y sirve para agrupar;
 * las columnas de texto responden «qué decía el papel».
 */
export class AddClientes1783800000000 implements MigrationInterface {
  name = 'AddClientes1783800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "clientes" (
        "id" character varying NOT NULL,
        "nombre" character varying NOT NULL,
        "documento" character varying,
        "direccion" character varying,
        "telefono" character varying,
        "correo" character varying,
        "activo" boolean NOT NULL DEFAULT true,
        "creadoEn" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clientes" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS clientes_seq START WITH 1 INCREMENT BY 1`,
    );

    // Índice funcional: dos clientes no pueden llamarse igual aunque uno se
    // escriba con tildes y el otro no. Es la misma regla con la que se
    // agruparon los históricos, así que el catálogo no puede contradecirla.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_clientes_nombre_normalizado"
      ON "clientes" (${CLAVE('"nombre"')})
    `);

    // El documento identifica de verdad (NIT o cédula), pero es opcional:
    // el índice parcial deja convivir muchos clientes sin documento y a la
    // vez impide cargar dos veces el mismo NIT.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_clientes_documento"
      ON "clientes" (btrim("documento"))
      WHERE "documento" IS NOT NULL AND btrim("documento") <> ''
    `);

    // ── Poblar el catálogo desde las remisiones que ya existen ──
    //
    // El nombre queda en su forma normalizada (mayúsculas, sin tildes) en vez
    // de una de las grafías sueltas: elegir «la última que se escribió» daría
    // resultados como «  omar bermudez  ». Queda editable desde Configuración.
    //
    // Documento y dirección salen de la remisión MÁS RECIENTE que los tenga
    // cargados: es el dato más vigente que hay del cliente.
    //
    // Teléfono y correo nacen vacíos y no hay forma de evitarlo: la remisión
    // nunca los guardó, así que ese dato no existe en la base. Se completan a
    // mano desde Configuración → Clientes.
    await queryRunner.query(`
      WITH agrupado AS (
        SELECT
          ${CLAVE('r."clienteNombre"')} AS clave,
          (array_agg(r."clienteDocumento" ORDER BY r.fecha DESC, r.numero DESC)
             FILTER (WHERE r."clienteDocumento" IS NOT NULL
                       AND btrim(r."clienteDocumento") <> ''))[1] AS documento,
          (array_agg(r."clienteDireccion" ORDER BY r.fecha DESC, r.numero DESC)
             FILTER (WHERE r."clienteDireccion" IS NOT NULL
                       AND btrim(r."clienteDireccion") <> ''))[1] AS direccion
        FROM remisiones r
        WHERE r."clienteNombre" IS NOT NULL AND btrim(r."clienteNombre") <> ''
        GROUP BY 1
      )
      INSERT INTO "clientes" ("id", "nombre", "documento", "direccion")
      SELECT
        'CLI-' || lpad(nextval('clientes_seq')::text, 4, '0'),
        clave,
        documento,
        direccion
      FROM agrupado
      ORDER BY clave
    `);

    await queryRunner.query(
      `ALTER TABLE "remisiones" ADD COLUMN "clienteId" character varying`,
    );

    // Se engancha cada remisión con el cliente que le corresponde por nombre
    // normalizado. Después de este UPDATE ninguna debería quedar en NULL.
    await queryRunner.query(`
      UPDATE "remisiones" r
      SET "clienteId" = c."id"
      FROM "clientes" c
      WHERE ${CLAVE('r."clienteNombre"')} = ${CLAVE('c."nombre"')}
    `);

    // RESTRICT y no CASCADE: borrar un cliente con remisiones emitidas
    // borraría documentos entregados y su cartera. Para dar de baja está
    // `activo`, igual que en operarios y administrativos.
    await queryRunner.query(`
      ALTER TABLE "remisiones"
      ADD CONSTRAINT "FK_remisiones_cliente"
      FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_remisiones_cliente" ON "remisiones" ("clienteId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_remisiones_cliente"`);
    await queryRunner.query(
      `ALTER TABLE "remisiones" DROP CONSTRAINT IF EXISTS "FK_remisiones_cliente"`,
    );
    await queryRunner.query(
      `ALTER TABLE "remisiones" DROP COLUMN IF EXISTS "clienteId"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_clientes_documento"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_clientes_nombre_normalizado"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "clientes"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS clientes_seq`);
  }
}
