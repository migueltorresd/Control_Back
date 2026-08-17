import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ValesRepository } from './vales.repository';
import { ReferenciasService } from '../referencias/referencias.service';
import { AdministrativosService } from '../administrativos/administrativos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { aPngParaPdf } from '../../common/utils/imagen-pdf.util';
import { Vale } from './entities/vale.entity';
import { EstadoVale } from '../../common/enums/estado-vale.enum';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';

/**
 * ¿Son el mismo cuadro de tallas? Compara por contenido y no por
 * `JSON.stringify`: el orden de las claves depende de cómo las mandó el front y
 * de cómo salieron de la base, y dos cuadros idénticos en distinto orden darían
 * "cambió" siendo mentira.
 */
function mismoCuadro(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  const clavesA = Object.keys(a);
  const clavesB = Object.keys(b);
  if (clavesA.length !== clavesB.length) return false;
  return clavesA.every((k) => a[k] === b[k]);
}

export interface CreateValeServiceDto {
  fecha: string;
  almacen: string;
  color: string;
  altura?: string | null;
  referenciaId: string;
  creadoPorId?: string | null;
  tallas: { talla: number; cantidad: number }[];
}

export interface ModificarValeServiceDto {
  fecha?: string;
  almacen?: string;
  color?: string;
  altura?: string;
  creadoPorId?: string;
  tallas?: { talla: number; cantidad: number }[];
  modificadoPorId: string;
}

/** Campos del vale que la modificación puede tocar. `referenciaId` no está: ver ModificarValeDto. */
const CAMPOS_EDITABLES = [
  'fecha',
  'almacen',
  'color',
  'altura',
  'creadoPorId',
] as const;

@Injectable()
export class ValesService {
  private readonly logger = new Logger(ValesService.name);

  constructor(
    private readonly repository: ValesRepository,
    private readonly referenciasService: ReferenciasService,
    private readonly administrativosService: AdministrativosService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async findAll(): Promise<Vale[]> {
    return this.repository.findAllWithRelations();
  }

  async findAllPaginated(opts: {
    page: number;
    limit: number;
    desde?: string;
    hasta?: string;
  }): Promise<{ data: Vale[]; total: number }> {
    const [data, total] = await this.repository.findPaginated({
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      desde: opts.desde,
      hasta: opts.hasta,
    });
    return { data, total };
  }

  async findOne(id: string): Promise<Vale> {
    const vale = await this.repository.findByIdWithRelations(id);
    if (!vale) {
      throw new NotFoundException(`Vale con ID ${id} no encontrado`);
    }
    return vale;
  }

  /**
   * Un vale anulado no admite producción, revisión ni pago: es la puerta que
   * usan ProduccionService y PagosService antes de operar sobre él.
   */
  assertVigente(vale: Vale): void {
    if (vale.estado === EstadoVale.ANULADO) {
      throw new BadRequestException(
        `El vale ${vale.id} está anulado y no admite operaciones. ` +
          `Motivo de la anulación: ${vale.motivoAnulacion ?? 'sin registrar'}.`,
      );
    }
  }

  /**
   * Foto del modelo, ya normalizada a PNG chico para el PDF del vale. Nunca
   * falla: si la referencia no tiene imagen o no se puede convertir, el vale se
   * imprime igual con el marcador «sin foto».
   */
  async fotoDelModelo(referenciaId: string): Promise<Buffer | undefined> {
    let datos: Buffer;
    try {
      ({ datos } = await this.referenciasService.getImagen(referenciaId));
    } catch {
      this.logger.log(
        `La referencia ${referenciaId} no tiene imagen; el vale sale sin foto.`,
      );
      return undefined;
    }
    return aPngParaPdf(datos);
  }

  async create(dto: CreateValeServiceDto): Promise<Vale> {
    // 1. Validar que la referencia exista usando el ReferenciasService
    await this.referenciasService.findOne(dto.referenciaId);

    // 2. Si viene responsable, tiene que existir y estar activo. Un vale no se
    // firma a nombre de alguien que ya no está.
    if (dto.creadoPorId) {
      await this.administrativosService.assertSeleccionable(dto.creadoPorId);
    }

    // 3. Delegar la creación transaccional al repositorio (el ID lo genera la secuencia vales_seq)
    return this.repository.crearConRelaciones(
      {
        fecha: dto.fecha,
        almacen: dto.almacen,
        color: dto.color,
        altura: dto.altura,
        referenciaId: dto.referenciaId,
        creadoPorId: dto.creadoPorId ?? null,
      },
      dto.tallas,
    );
  }

  /**
   * Reasigna el responsable de un vale ya creado — es el selector de la ficha
   * del vale, que puede completarse después del alta.
   */
  async asignarResponsable(id: string, creadoPorId: string): Promise<Vale> {
    const vale = await this.findOne(id);
    this.assertVigente(vale);
    await this.administrativosService.assertSeleccionable(creadoPorId);
    await this.repository.update(id, { creadoPorId });
    return this.findOne(id);
  }

  /**
   * Modifica un vale que todavía no tocó plata.
   *
   * La regla del cliente es «solo antes del pago», y el pago no es del vale sino
   * de cada registro de producción por etapa y operario. Traducido: alcanza con
   * UN registro pagado para congelar el vale entero. No se puede corregir un
   * cuadro de tallas sobre el que ya se liquidó trabajo.
   */
  async modificar(
    id: string,
    dto: ModificarValeServiceDto,
    username?: string,
  ): Promise<Vale> {
    const vale = await this.findOne(id);
    this.assertVigente(vale);
    this.assertSinPagos(vale, 'modificar');

    // Quien firma la modificación tiene que existir y estar activo.
    await this.administrativosService.assertSeleccionable(dto.modificadoPorId);
    if (dto.creadoPorId !== undefined) {
      await this.administrativosService.assertSeleccionable(dto.creadoPorId);
    }

    if (dto.tallas) {
      this.assertCupoAlcanza(vale, dto.tallas);
    }

    const { cambios, antes, despues } = this.diffCampos(vale, dto);

    // El formulario manda SIEMPRE el cuadro de tallas completo, se haya tocado o
    // no. Sin comparar, cada corrección de color quedaría auditada como si
    // también hubieran cambiado las tallas — y el historial dejaría de servir
    // para saber qué se tocó, que es todo el motivo por el que existe.
    const tallasAntes = this.tallasComoObjeto(vale);
    const tallasDespues = dto.tallas
      ? Object.fromEntries(dto.tallas.map((t) => [String(t.talla), t.cantidad]))
      : null;
    const tallasCambiaron =
      tallasDespues !== null && !mismoCuadro(tallasAntes, tallasDespues);

    if (tallasCambiaron) {
      antes.tallas = tallasAntes;
      despues.tallas = tallasDespues;
    }

    if (Object.keys(despues).length === 0) {
      throw new BadRequestException(
        'La modificación no cambia ningún dato del vale.',
      );
    }

    return this.repository.dataSource.transaction(async (mgr) => {
      await this.repository.aplicarModificacion(
        id,
        {
          ...cambios,
          modificadoPorId: dto.modificadoPorId,
          modificadoEn: new Date(),
        },
        // Si el cuadro vino igual, no se reescriben las filas al pedo.
        tallasCambiaron ? dto.tallas : undefined,
        mgr,
      );

      await this.auditoriaService.registrar(
        {
          usuario: username || 'system',
          accion: 'MODIFICAR_VALE',
          entidad: 'Vale',
          entidadId: id,
          detalle: {
            // El administrativo lo declara el front (todavía no hay login por
            // persona); `usuario` es la identidad verificada del token. Se
            // guardan las dos porque no siempre son la misma.
            modificadoPorId: dto.modificadoPorId,
            campos: Object.keys(despues),
            antes,
            despues,
          },
        },
        mgr,
      );

      this.logger.log(
        `Vale modificado: ${id} — campos [${Object.keys(despues).join(', ')}] ` +
          `por el administrativo ${dto.modificadoPorId} (usuario ${username || 'system'}).`,
      );

      const actualizado = await this.repository.findByIdWithRelationsEn(
        id,
        mgr,
      );
      return actualizado!;
    });
  }

  /**
   * Anula un vale. No lo borra: nunca se borra. Conserva producción, rechazos y
   * su historia, y queda inhabilitado para cualquier operación posterior.
   */
  async anular(
    id: string,
    motivo: string,
    anuladoPorId: string,
    username?: string,
  ): Promise<Vale> {
    const vale = await this.findOne(id);

    if (vale.estado === EstadoVale.ANULADO) {
      throw new BadRequestException(`El vale ${id} ya está anulado.`);
    }
    this.assertSinPagos(vale, 'anular');

    await this.administrativosService.assertSeleccionable(anuladoPorId);

    return this.repository.dataSource.transaction(async (mgr) => {
      await this.repository.aplicarModificacion(
        id,
        {
          estado: EstadoVale.ANULADO,
          motivoAnulacion: motivo.trim(),
          anuladoPorId,
          anuladoEn: new Date(),
        },
        undefined,
        mgr,
      );

      await this.auditoriaService.registrar(
        {
          usuario: username || 'system',
          accion: 'ANULAR_VALE',
          entidad: 'Vale',
          entidadId: id,
          detalle: {
            anuladoPorId,
            motivo: motivo.trim(),
            // Qué había en el vale al momento de anularlo: sin esto, un vale
            // anulado no se puede reconstruir para entender qué se perdió.
            referenciaId: vale.referenciaId,
            tallas: this.tallasComoObjeto(vale),
            produccion: vale.produccion.map((r) => ({
              id: r.id,
              etapa: r.etapa,
              operarioId: r.operarioId,
              pares: r.pares,
              estado: r.estado,
              montoPagado: r.montoPagado,
            })),
          },
        },
        mgr,
      );

      this.logger.log(
        `Vale anulado: ${id} por el administrativo ${anuladoPorId} ` +
          `(usuario ${username || 'system'}). Motivo: ${motivo.trim()}`,
      );

      const actualizado = await this.repository.findByIdWithRelationsEn(
        id,
        mgr,
      );
      return actualizado!;
    });
  }

  // ── guardas ────────────────────────────────────────────────────────────────

  /**
   * El freno que pidió el cliente. Un solo registro pagado alcanza: la plata ya
   * salió contra este vale, y el comprobante de pago quedó emitido con estos
   * datos. Corregirlos después haría mentir al comprobante.
   */
  private assertSinPagos(vale: Vale, accion: 'modificar' | 'anular'): void {
    const pagados = (vale.produccion ?? []).filter(
      (r) => r.estado === EstadoProduccion.PAGADO,
    );
    if (pagados.length === 0) return;

    const detalle = pagados
      .map((r) => `${r.etapa} (operario ${r.operarioId})`)
      .join(', ');

    throw new BadRequestException(
      `No se puede ${accion} el vale ${vale.id}: ya tiene producción pagada en ${detalle}. ` +
        `Anule primero esos pagos desde el módulo de pagos.`,
    );
  }

  /**
   * Las tallas definen el cupo de pares del vale, y ese cupo es el techo de cada
   * etapa (ver ProduccionService.registerProduccion). Bajarlo por debajo de lo ya
   * registrado dejaría etapas pasadas de cupo: producción real que el vale, en
   * los papeles, nunca autorizó.
   */
  private assertCupoAlcanza(
    vale: Vale,
    tallas: { talla: number; cantidad: number }[],
  ): void {
    const nuevoCupo = tallas.reduce((acc, t) => acc + t.cantidad, 0);

    const paresPorEtapa = new Map<string, number>();
    for (const reg of vale.produccion ?? []) {
      // Las asignaciones (pares en null) todavía no consumen cupo.
      if (reg.pares === null) continue;
      paresPorEtapa.set(
        reg.etapa,
        (paresPorEtapa.get(reg.etapa) ?? 0) + reg.pares,
      );
    }

    for (const [etapa, pares] of paresPorEtapa) {
      if (pares > nuevoCupo) {
        throw new BadRequestException(
          `No se pueden dejar ${nuevoCupo} pares en el vale ${vale.id}: la etapa ` +
            `${etapa} ya tiene ${pares} pares registrados. Reduzca primero esa ` +
            `producción o deje un cupo de al menos ${pares} pares.`,
        );
      }
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /**
   * Compara campo por campo y devuelve solo lo que realmente cambia. Sin esto,
   * la auditoría registraría como «modificado» todo campo que el front reenvía
   * igual, y el historial dejaría de servir para saber qué se tocó.
   */
  private diffCampos(
    vale: Vale,
    dto: ModificarValeServiceDto,
  ): {
    cambios: Partial<Vale>;
    antes: Record<string, unknown>;
    despues: Record<string, unknown>;
  } {
    const cambios: Partial<Vale> = {};
    const antes: Record<string, unknown> = {};
    const despues: Record<string, unknown> = {};

    for (const campo of CAMPOS_EDITABLES) {
      const nuevo = dto[campo];
      if (nuevo === undefined) continue;

      const actual = vale[campo];
      if (actual === nuevo) continue;

      antes[campo] = actual;
      despues[campo] = nuevo;
      (cambios as Record<string, unknown>)[campo] = nuevo;
    }

    return { cambios, antes, despues };
  }

  private tallasComoObjeto(vale: Vale): Record<string, number> {
    return Object.fromEntries(
      (vale.tallas ?? []).map((t) => [String(t.talla), t.cantidad]),
    );
  }
}
