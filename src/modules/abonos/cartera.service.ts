import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AbonosRepository } from './abonos.repository';
import { AdministrativosService } from '../administrativos/administrativos.service';
import { Abono } from './entities/abono.entity';
import { MetodoAbono } from '../../common/enums/metodo-abono.enum';
import { EstadoDocumento } from '../../common/enums/estado-documento.enum';
import { FormaPago } from '../../common/enums/forma-pago.enum';
import { hoyLocal } from '../../common/utils/fecha.util';

/**
 * Clave con la que se agrupan las remisiones de un mismo cliente.
 *
 * El nombre del cliente es texto libre, así que «OMAR BERMUDEZ», «Omar Bermúdez»
 * y «  omar bermudez  » son tres registros distintos para la base y una sola
 * persona en la realidad. Se normalizan cuatro cosas:
 *
 * 1. tildes y diéresis  → «Omar Bermúdez» = «Omar Bermudez»
 * 2. mayúsculas         → «omar bermudez» = «OMAR BERMUDEZ»
 * 3. puntos y comas     → «DOTASIF S.A.S» = «DOTASIF SAS»
 * 4. espacios de sobra  → «  omar   bermudez » = «OMAR BERMUDEZ»
 *
 * El punto 3 no es cosmético: sin él un mismo cliente aparece partido en dos
 * cuentas, el total que se le cobra queda incompleto y un abono no cruza de
 * una mitad a la otra. En razones sociales colombianas SAS / S.A.S / S.A.S.
 * conviven en la misma base todo el tiempo.
 *
 * `translate` y no `unaccent`: esta última necesita CREATE EXTENSION, un
 * permiso que el Postgres gestionado puede no dar, y no vale la pena que la
 * cartera dependa de eso. Con el 'to' más corto que el 'from', `translate`
 * borra los caracteres sobrantes en vez de reemplazarlos.
 *
 * Es una solución de agrupación, NO de identidad: «OMAR B» y «OMAR BERMUDEZ»
 * siguen siendo dos. Por eso solo se usa como RESPALDO — ver `CLAVE_CLIENTE`.
 */
const CLAVE_POR_NOMBRE = `upper(
  regexp_replace(
    translate(btrim(r."clienteNombre"), 'áéíóúÁÉÍÓÚñÑüÜ.,', 'aeiouAEIOUnNuU'),
    -- clase POSIX y no \\s: en un template literal de TS el backslash se
    -- perdería y el patrón buscaría la letra «s».
    '[[:space:]]+', ' ', 'g'
  )
)`;

/**
 * Con qué se agrupan las remisiones de un mismo cliente.
 *
 * Primero el `clienteId` del catálogo: es identidad de verdad, no una
 * comparación de textos, así que no hay grafía capaz de partir a un cliente en
 * dos cuentas. Si la remisión no está vinculada —porque se emitió antes del
 * catálogo o a mano— se cae al nombre normalizado, que resuelve la mayoría de
 * los casos aunque no todos.
 *
 * El prefijo `N:` evita que una clave por nombre pueda confundirse con un id
 * `CLI-0001`, y deja ver de un vistazo qué cuentas todavía no están vinculadas.
 */
const CLAVE_CLIENTE = `COALESCE(r."clienteId", 'N:' || ${CLAVE_POR_NOMBRE})`;

export interface RemisionEnCuenta {
  numero: string;
  fecha: string;
  /** El nombre tal como se escribió en esta remisión, sin normalizar. */
  cliente: string;
  total: number;
  abonado: number;
  saldo: number;
}

export interface CuentaCliente {
  cliente: string;
  clave: string;
  /**
   * El id del catálogo, o null si esta cuenta se armó agrupando por nombre.
   * Un null es señal de que hay remisiones sin vincular a un cliente.
   */
  clienteId: string | null;
  /** Del catálogo. Es el dato que se usa para salir a cobrar. */
  telefono: string | null;
  remisiones: number;
  total: number;
  abonado: number;
  saldo: number;
  masAntigua: string | null;
  detalle: RemisionEnCuenta[];
}

/** Una porción de un abono repartido, ya aplicada a su remisión. */
export interface AplicacionAbono {
  remision: string;
  monto: number;
  abonoId: string;
  saldoAnterior: number;
  saldoNuevo: number;
}

@Injectable()
export class CarteraService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly abonosRepository: AbonosRepository,
    private readonly administrativosService: AdministrativosService,
  ) {}

  /** Clientes con saldo pendiente, del que más debe al que menos. */
  async clientesConDeuda(): Promise<CuentaCliente[]> {
    const claves = await this.dataSource.query<{ clave: string }[]>(
      `SELECT DISTINCT ${CLAVE_CLIENTE} AS clave
       FROM remisiones r
       WHERE r."formaPago" = $1 AND r.estado = $2`,
      [FormaPago.CREDITO, EstadoDocumento.ACTIVO],
    );

    const cuentas = await Promise.all(
      claves.map((c) => this.cuentaDe(c.clave)),
    );
    return cuentas.filter((c) => c.saldo > 0).sort((a, b) => b.saldo - a.saldo);
  }

  /**
   * Estado de cuenta de un cliente, con sus remisiones de la más antigua a la
   * más nueva: ese es el orden en que se cobra y en que se aplica un abono.
   */
  async cuentaDe(
    clave: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<CuentaCliente> {
    const filas = await manager.query<
      {
        numero: string;
        fecha: string;
        cliente: string;
        catalogo: string | null;
        telefono: string | null;
        total: string;
        abonado: string;
      }[]
    >(
      `SELECT r.numero,
              -- to_char y no r.fecha: en las consultas crudas el driver de pg
              -- entrega las columnas date como objeto Date, mientras que las
              -- entidades de TypeORM las devuelven como string YYYY-MM-DD. Sin
              -- esto la cartera hablaría un formato distinto al del resto de
              -- la API.
              to_char(r.fecha, 'YYYY-MM-DD') AS fecha,
              r."clienteNombre" AS cliente,
              -- El nombre del catálogo es el que el usuario puede corregir,
              -- así que es el que se muestra. Sin vínculo no hay catálogo y
              -- queda la clave normalizada.
              cli.nombre AS catalogo,
              cli.telefono AS telefono,
              COALESCE(v.total, 0) AS total,
              COALESCE(a.abonado, 0) AS abonado
       FROM remisiones r
       LEFT JOIN clientes cli ON cli.id = r."clienteId"
       LEFT JOIN LATERAL (
         SELECT SUM(ve.pares * ve."precioUnitario") AS total
         FROM ventas ve
         WHERE ve."remisionId" = r.numero AND ve.estado = $3
       ) v ON true
       LEFT JOIN LATERAL (
         SELECT SUM(ab.monto) AS abonado
         FROM abonos ab
         WHERE ab."remisionId" = r.numero AND ab.estado = $3
       ) a ON true
       WHERE ${CLAVE_CLIENTE} = $1
         AND r."formaPago" = $2
         AND r.estado = $3
       -- Más antigua primero: es el orden de cobro y el de aplicación FIFO.
       -- El número desempata para que dos del mismo día no queden al azar.
       ORDER BY r.fecha ASC, r.numero ASC`,
      [clave, FormaPago.CREDITO, EstadoDocumento.ACTIVO],
    );

    const detalle: RemisionEnCuenta[] = filas.map((f) => {
      const total = Number(f.total);
      const abonado = Number(f.abonado);
      return {
        numero: f.numero,
        fecha: f.fecha,
        cliente: f.cliente?.trim() ?? '',
        total,
        abonado,
        saldo: Number((total - abonado).toFixed(2)),
      };
    });

    const suma = (k: 'total' | 'abonado' | 'saldo') =>
      Number(detalle.reduce((s, d) => s + d[k], 0).toFixed(2));

    return {
      // El nombre del catálogo manda: es el único que el usuario puede
      // corregir y sale igual en todas partes. Sin vínculo queda la clave
      // normalizada (sin el prefijo técnico), porque elegir "la última grafía
      // que se escribió" daría «omar bermudez» en minúsculas y el nombre
      // cambiaría solo al cargar una remisión nueva.
      cliente: filas[0]?.catalogo?.trim() || clave.replace(/^N:/, ''),
      clave,
      clienteId: clave.startsWith('N:') ? null : clave,
      telefono: filas[0]?.telefono?.trim() || null,
      remisiones: detalle.length,
      total: suma('total'),
      abonado: suma('abonado'),
      saldo: suma('saldo'),
      masAntigua: detalle.find((d) => d.saldo > 0)?.fecha ?? null,
      detalle,
    };
  }

  /**
   * Aplica un abono del cliente repartiéndolo entre sus remisiones, de la más
   * antigua a la más nueva.
   *
   * No hay tabla nueva: cada porción se guarda como un abono contra su
   * remisión, igual que si se hubiera cargado a mano. Así el saldo de cada
   * documento se sigue calculando igual y el PDF de cada remisión sigue
   * cuadrando solo.
   *
   * Todo en una transacción y releyendo los saldos adentro: dos personas
   * cobrando a la vez, con reparto automático, es la forma más fácil de
   * aplicar dos veces la misma plata.
   */
  async abonarACliente(
    clave: string,
    monto: number,
    metodo: MetodoAbono,
    registradoPorId: string,
    observaciones?: string,
    fecha?: string,
  ): Promise<{ aplicado: AplicacionAbono[]; cuenta: CuentaCliente }> {
    if (monto <= 0) {
      throw new BadRequestException('El abono debe ser mayor a cero.');
    }
    await this.administrativosService.assertSeleccionable(registradoPorId);

    const dia = fecha || hoyLocal();

    const aplicado: AplicacionAbono[] = [];

    await this.dataSource.transaction(async (manager) => {
      const cuenta = await this.cuentaDe(clave, manager);

      if (cuenta.saldo <= 0) {
        throw new BadRequestException(
          `${cuenta.cliente} no tiene saldo pendiente.`,
        );
      }
      // Recibir de más no es un abono: sobra plata que no se sabe a qué
      // documento pertenece.
      if (monto > cuenta.saldo) {
        throw new BadRequestException(
          `El abono de ${monto} supera la deuda total de ${cuenta.cliente}, que es ${cuenta.saldo}.`,
        );
      }

      let restante = monto;
      for (const r of cuenta.detalle) {
        if (restante <= 0) break;
        if (r.saldo <= 0) continue;

        const aplicar = Math.min(restante, r.saldo);
        const id = await this.abonosRepository.nextId(manager);
        await manager.insert(Abono, {
          id,
          remisionId: r.numero,
          fecha: dia,
          monto: aplicar,
          metodo,
          observaciones: observaciones ?? null,
          registradoPorId,
        });

        // El detalle del reparto se devuelve para poder mostrarlo: quien cobra
        // necesita ver a qué remisiones se fue la plata que acaba de recibir.
        aplicado.push({
          remision: r.numero,
          monto: aplicar,
          abonoId: id,
          saldoAnterior: r.saldo,
          saldoNuevo: Number((r.saldo - aplicar).toFixed(2)),
        });

        restante = Number((restante - aplicar).toFixed(2));
      }
    });

    // Se relee al final para devolver el estado real, no el que se calculó
    // mientras se escribía.
    const cuenta = await this.cuentaDe(clave);
    return { aplicado, cuenta };
  }
}
