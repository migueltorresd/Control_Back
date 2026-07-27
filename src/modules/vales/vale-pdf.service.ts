import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { Vale } from './entities/vale.entity';
import { Oficio } from '../../common/enums/oficio.enum';

const EMPRESA = 'Scala Leather S.A.S.';

// Paleta del formato aprobado por el cliente: dorado de marca sobre tintas cálidas.
const ORO = '#C9A227';
const TINTA = '#1A1A1A';
const GRIS = '#8C8578';
const GRIS_SUAVE = '#B5AEA0';
const LINEA = '#E2DCD0';
const FONDO = '#F5F2EA';
const NEGRO = '#111111';

// Geometría de página A4 con margen de 40 pt
const LEFT = 40;
const RIGHT = 555;
const WIDTH = RIGHT - LEFT; // 515

/** Etapas de la rejilla de firmas, en el orden del formato impreso. */
const ETAPAS_GRID: Oficio[][] = [
  [Oficio.FINIZAJE, Oficio.GUARNECEDOR],
  [Oficio.SOLADOR, Oficio.CORTADOR],
];

/** Una tirilla desprendible por etapa, en el orden del formato impreso. */
const ETAPAS_TIRILLA: Oficio[] = [
  Oficio.FINIZAJE,
  Oficio.SOLADOR,
  Oficio.GUARNECEDOR,
  Oficio.CORTADOR,
];

const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/**
 * Logo de marca. En desarrollo resuelve a `src/assets/`; compilado, a
 * `dist/assets/` (nest-cli.json copia la carpeta en el build).
 */
const LOGO_PATH = join(__dirname, '..', '..', 'assets', 'logo-scala.png');

export interface ValePdfExtras {
  /**
   * Foto del modelo ya normalizada a PNG (ver `aPngParaPdf`). Si falta, se
   * dibuja el marcador «SIN FOTO».
   */
  fotoModelo?: Buffer;
}

@Injectable()
export class ValePdfService {
  private readonly logger = new Logger(ValePdfService.name);
  private logoCache?: Buffer | null;

  /** Genera el PDF de un vale de producción y lo devuelve como Buffer. */
  generar(vale: Vale, extras: ValePdfExtras = {}): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y = this.encabezado(doc, vale, extras);
      y = this.datosGenerales(doc, vale, y);
      y = this.tablaTallas(doc, vale, y);
      y = this.rejillaEtapas(doc, vale, y);
      this.tirillas(doc, vale, y);
      this.pie(doc);

      doc.end();
    });
  }

  // ─── Encabezado: logo, foto del modelo y número de vale ──────────────────
  private encabezado(
    doc: PDFKit.PDFDocument,
    vale: Vale,
    extras: ValePdfExtras,
  ): number {
    const logo = this.logo();
    if (logo) {
      try {
        doc.image(logo, LEFT, 38, { fit: [96, 40] });
      } catch {
        this.marcaTextual(doc);
      }
    } else {
      this.marcaTextual(doc);
    }

    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(7)
      .text('VALE DE PRODUCCIÓN', LEFT, 84, { characterSpacing: 2.5 });

    // Foto del modelo, a la izquierda del número de vale
    const fotoW = 62;
    const fotoX = 395;
    const fotoY = 36;
    doc
      .rect(fotoX, fotoY, fotoW, fotoW)
      .lineWidth(1)
      .fillAndStroke('#FFFFFF', LINEA);
    this.dibujarFoto(doc, extras, fotoX, fotoY, fotoW);

    // Quién dio de alta el vale. Se omite la línea entera si el vale no tiene
    // responsable: un rótulo con la raya vacía sugiere un dato que falta cargar,
    // cuando en los vales viejos simplemente no existe.
    if (vale.creadoPor) {
      const label = 'CREADO POR';
      doc
        .fillColor(GRIS_SUAVE)
        .font('Helvetica')
        .fontSize(5.5)
        .text(label, LEFT, 97, { characterSpacing: 1, lineBreak: false });
      // Posición absoluta en vez de `continued`: al cambiar el tamaño de fuente
      // a mitad de línea pdfkit recalcula el alto de renglón y empuja el texto
      // hacia abajo, encima de la regla dorada.
      const xNombre =
        LEFT + doc.widthOfString(label, { characterSpacing: 1 }) + 6;
      doc
        .fillColor(TINTA)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(vale.creadoPor.nombre, xNombre, 95, {
          width: fotoX - xNombre - 10,
          lineBreak: false,
          ellipsis: true,
        });
    }

    // Bloque del número de vale, alineado al margen derecho
    const bloqueX = 470;
    const bloqueW = RIGHT - bloqueX;
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(6.5)
      .text('VALE', bloqueX, 44, {
        width: bloqueW,
        align: 'right',
        characterSpacing: 2,
      });
    doc
      .fillColor(ORO)
      .font('Helvetica-Bold')
      .fontSize(19)
      .text(vale.id, bloqueX, 55, { width: bloqueW, align: 'right' });
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(7.5)
      .text(vale.fecha, bloqueX, 80, { width: bloqueW, align: 'right' });

    const hora = this.horaCreacion(vale);
    if (hora) {
      doc
        .fillColor(GRIS_SUAVE)
        .font('Helvetica')
        .fontSize(7)
        .text(hora, bloqueX, 91, { width: bloqueW, align: 'right' });
    }

    // Regla dorada de marca
    const yRegla = 106;
    doc.rect(LEFT, yRegla, WIDTH, 3).fillColor(ORO).fill();

    return yRegla + 16;
  }

  /** Respaldo cuando el archivo del logo no está disponible. */
  private marcaTextual(doc: PDFKit.PDFDocument): void {
    doc
      .fillColor(TINTA)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text('Scala Leather', LEFT, 48, { characterSpacing: 0.5 });
  }

  private dibujarFoto(
    doc: PDFKit.PDFDocument,
    extras: ValePdfExtras,
    x: number,
    y: number,
    lado: number,
  ): void {
    if (extras.fotoModelo && extras.fotoModelo.length > 0) {
      try {
        doc.image(extras.fotoModelo, x + 3, y + 3, {
          fit: [lado - 6, lado - 6],
          align: 'center',
          valign: 'center',
        });
        return;
      } catch (e) {
        // Una imagen corrupta no puede tumbar la generación del vale entero.
        this.logger.warn(
          `No se pudo incrustar la foto del modelo: ${(e as Error).message}`,
        );
      }
    }

    doc
      .fillColor(GRIS_SUAVE)
      .font('Helvetica')
      .fontSize(6)
      .text('SIN FOTO', x, y + lado / 2 - 4, {
        width: lado,
        align: 'center',
        characterSpacing: 1,
      });
  }

  // ─── Fila de datos generales ─────────────────────────────────────────────
  private datosGenerales(
    doc: PDFKit.PDFDocument,
    vale: Vale,
    y: number,
  ): number {
    const totalPares = this.totalPares(vale);
    const alto = 34;
    const columnas: { label: string; valor: string; ancho: number }[] = [
      {
        label: 'Modelo',
        valor: vale.referencia?.nombre ?? vale.referenciaId,
        ancho: 130,
      },
      { label: 'Color', valor: vale.color, ancho: 130 },
      { label: 'Altura', valor: vale.altura ?? '—', ancho: 90 },
      { label: 'Almacén', valor: vale.almacen, ancho: 90 },
      { label: 'Total pares', valor: String(totalPares), ancho: 75 },
    ];

    let x = LEFT;
    columnas.forEach((col, i) => {
      if (i > 0) {
        doc
          .moveTo(x - 8, y)
          .lineTo(x - 8, y + alto)
          .lineWidth(0.75)
          .strokeColor(LINEA)
          .stroke();
      }
      doc
        .fillColor(GRIS)
        .font('Helvetica')
        .fontSize(6)
        .text(col.label.toUpperCase(), x, y, { characterSpacing: 1.5 });
      doc
        .fillColor(col.label === 'Total pares' ? ORO : TINTA)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(col.valor || '—', x, y + 12, {
          width: col.ancho - 10,
          lineBreak: false,
          ellipsis: true,
        });
      x += col.ancho;
    });

    return y + alto + 12;
  }

  // ─── Tabla de tallas ─────────────────────────────────────────────────────
  private tablaTallas(doc: PDFKit.PDFDocument, vale: Vale, y: number): number {
    const tallas = [...(vale.tallas ?? [])].sort((a, b) => a.talla - b.talla);
    const totalPares = this.totalPares(vale);

    if (tallas.length === 0) {
      doc
        .fillColor(GRIS)
        .font('Helvetica-Oblique')
        .fontSize(9)
        .text('Sin tallas registradas.', LEFT, y);
      return y + 26;
    }

    const altoCab = 19;
    const altoVal = 24;
    const totalW = Math.min(120, Math.max(70, WIDTH - tallas.length * 30));
    const cellW = (WIDTH - totalW) / tallas.length;
    const chico = cellW < 30;

    let x = LEFT;
    for (const t of tallas) {
      doc
        .rect(x, y, cellW, altoCab)
        .lineWidth(0.75)
        .fillAndStroke(FONDO, LINEA);
      doc
        .fillColor(GRIS)
        .font('Helvetica-Bold')
        .fontSize(chico ? 7 : 8)
        .text(String(t.talla), x, y + (chico ? 6 : 5.5), {
          width: cellW,
          align: 'center',
        });

      doc
        .rect(x, y + altoCab, cellW, altoVal)
        .lineWidth(0.75)
        .fillAndStroke('#FFFFFF', LINEA);
      doc
        .fillColor(TINTA)
        .font('Helvetica-Bold')
        .fontSize(chico ? 9 : 11)
        .text(String(t.cantidad), x, y + altoCab + (chico ? 7 : 6), {
          width: cellW,
          align: 'center',
        });
      x += cellW;
    }

    // Celda TOTAL, en negativo
    doc.rect(x, y, totalW, altoCab).fillColor(NEGRO).fill();
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text('TOTAL', x, y + 6, {
        width: totalW,
        align: 'center',
        characterSpacing: 1.5,
      });
    doc
      .rect(x, y + altoCab, totalW, altoVal)
      .fillColor(NEGRO)
      .fill();
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(String(totalPares), x, y + altoCab + 6, {
        width: totalW,
        align: 'center',
      });

    return y + altoCab + altoVal + 18;
  }

  // ─── Rejilla de firmas por etapa ─────────────────────────────────────────
  private rejillaEtapas(
    doc: PDFKit.PDFDocument,
    vale: Vale,
    y: number,
  ): number {
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(6)
      .text('PRODUCCIÓN POR ETAPA', LEFT, y, { characterSpacing: 1.5 });

    let cursorY = y + 12;
    const alto = 21;
    const anchoCelda = (WIDTH - 8) / 2;
    const anchoChip = 74;

    for (const fila of ETAPAS_GRID) {
      fila.forEach((etapa, i) => {
        const x = LEFT + i * (anchoCelda + 8);
        doc
          .rect(x, cursorY, anchoCelda, alto)
          .lineWidth(0.75)
          .fillAndStroke('#FFFFFF', LINEA);
        doc
          .rect(x, cursorY, anchoChip, alto)
          .lineWidth(0.75)
          .fillAndStroke(FONDO, LINEA);
        doc
          .fillColor(TINTA)
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .text(etapa.toUpperCase(), x + 6, cursorY + 7, {
            width: anchoChip - 8,
            lineBreak: false,
          });
        doc
          .fillColor(GRIS_SUAVE)
          .font('Helvetica')
          .fontSize(5.5)
          .text('NOMBRE', x + anchoChip + 5, cursorY + 8.5, {
            characterSpacing: 0.5,
          });

        const nombre = this.operariosDeEtapa(vale, etapa);
        if (nombre) {
          doc
            .fillColor(TINTA)
            .font('Helvetica')
            .fontSize(8)
            .text(nombre, x + anchoChip + 38, cursorY + 7, {
              width: anchoCelda - anchoChip - 44,
              lineBreak: false,
              ellipsis: true,
            });
        }
      });
      cursorY += alto + 4;
    }

    return cursorY + 12;
  }

  // ─── Tirillas desprendibles ──────────────────────────────────────────────
  private tirillas(doc: PDFKit.PDFDocument, vale: Vale, y: number): void {
    const alto = 116;
    let cursorY = y;

    for (const etapa of ETAPAS_TIRILLA) {
      if (cursorY + alto > 770) {
        doc.addPage();
        cursorY = 48;
      }
      this.tirilla(doc, vale, etapa, cursorY, alto);
      cursorY += alto;
    }
  }

  private tirilla(
    doc: PDFKit.PDFDocument,
    vale: Vale,
    etapa: Oficio,
    y: number,
    alto: number,
  ): void {
    // Línea de corte
    doc
      .dash(3, { space: 2.5 })
      .moveTo(LEFT, y)
      .lineTo(RIGHT, y)
      .lineWidth(0.75)
      .strokeColor(LINEA)
      .stroke()
      .undash();

    // Tijera (ZapfDingbats 0x22) + rótulo de corte
    doc
      .fillColor(GRIS_SUAVE)
      .font('ZapfDingbats')
      .fontSize(6.5)
      .text('"', LEFT, y + 8);
    doc
      .fillColor(GRIS_SUAVE)
      .font('Helvetica')
      .fontSize(5.5)
      .text(`TIRILLA ${etapa.toUpperCase()}`, LEFT + 10, y + 9, {
        characterSpacing: 1.5,
      });

    // Columna izquierda: etapa y fecha
    doc
      .fillColor(TINTA)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(etapa.toUpperCase(), LEFT, y + 22, { width: 84, lineBreak: false });
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(7)
      .text(this.fechaLarga(vale.fecha), LEFT, y + 38);

    const xSep = LEFT + 92;
    doc
      .moveTo(xSep, y + 18)
      .lineTo(xSep, y + alto - 14)
      .lineWidth(0.75)
      .strokeColor(LINEA)
      .stroke();

    // Resumen del vale
    const xCont = xSep + 10;
    const modelo = vale.referencia?.nombre ?? vale.referenciaId;
    doc
      .fillColor(TINTA)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(modelo, xCont, y + 22, { continued: true, lineBreak: false });
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(8)
      .text(
        ` · ${vale.color} · Almacén ${vale.almacen} · ${this.totalPares(vale)} pares`,
        { lineBreak: false },
      );

    // Campos a diligenciar en taller
    const xFinCampo = 455;
    const pares = this.paresDeEtapa(vale, etapa);
    this.campoLinea(
      doc,
      'NO. PARES',
      xCont,
      y + 52,
      xFinCampo,
      pares > 0 ? String(pares) : undefined,
    );
    this.campoLinea(
      doc,
      'NOMBRE',
      xCont,
      y + 82,
      xFinCampo,
      this.operariosDeEtapa(vale, etapa),
    );

    // Caja del número de vale
    const cajaX = 470;
    const cajaW = RIGHT - cajaX;
    const cajaY = y + 26;
    const cajaH = 42;
    doc
      .roundedRect(cajaX, cajaY, cajaW, cajaH, 4)
      .lineWidth(1.2)
      .fillAndStroke('#FFFFFF', TINTA);
    doc
      .fillColor(TINTA)
      .font('Helvetica-Bold')
      .fontSize(17)
      .text(vale.id, cajaX, cajaY + 13, { width: cajaW, align: 'center' });
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(5.5)
      .text('NO. DE VALE', cajaX, cajaY + cajaH + 5, {
        width: cajaW,
        align: 'center',
        characterSpacing: 1,
      });

    // Fecha de entrega: se escribe a mano al entregar la etapa, por eso va en
    // blanco. Cada etapa se entrega en un momento distinto, así que no puede
    // salir de un dato único del vale.
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(5.5)
      .text('FECHA DE ENTREGA', cajaX, cajaY + cajaH + 17, {
        width: cajaW,
        align: 'center',
        characterSpacing: 1,
      });
    // 20 pt entre el rótulo y la línea: menos que eso no entra una fecha escrita
    // a mano, que es para lo que existe este campo.
    doc
      .moveTo(cajaX, cajaY + cajaH + 37)
      .lineTo(RIGHT, cajaY + cajaH + 37)
      .lineWidth(0.75)
      .strokeColor(LINEA)
      .stroke();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Rótulo pequeño seguido de una línea para llenar a mano (o el dato ya conocido). */
  private campoLinea(
    doc: PDFKit.PDFDocument,
    label: string,
    x: number,
    y: number,
    xFin: number,
    valor?: string,
  ): void {
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(6.5)
      .text(label, x, y, { characterSpacing: 0.8 });
    const xLinea = x + doc.widthOfString(label, { characterSpacing: 0.8 }) + 6;
    if (valor) {
      doc
        .fillColor(TINTA)
        .font('Helvetica')
        .fontSize(9)
        .text(valor, xLinea + 2, y - 2, {
          width: xFin - xLinea - 4,
          lineBreak: false,
          ellipsis: true,
        });
    }
    doc
      .moveTo(xLinea, y + 8)
      .lineTo(xFin, y + 8)
      .lineWidth(0.75)
      .strokeColor(LINEA)
      .stroke();
  }

  private totalPares(vale: Vale): number {
    return (vale.tallas ?? []).reduce((s, t) => s + t.cantidad, 0);
  }

  private paresDeEtapa(vale: Vale, etapa: Oficio): number {
    return (vale.produccion ?? [])
      .filter((r) => r.etapa === etapa)
      .reduce((s, r) => s + (r.pares ?? 0), 0);
  }

  /** Nombres de quienes ya registraron producción en la etapa (vacío si nadie). */
  private operariosDeEtapa(vale: Vale, etapa: Oficio): string | undefined {
    const nombres = (vale.produccion ?? [])
      .filter((r) => r.etapa === etapa)
      .map((r) => r.operario?.nombre ?? r.operarioId);
    return nombres.length > 0 ? [...new Set(nombres)].join(', ') : undefined;
  }

  /**
   * Hora del alta como '09:46 p. m.'. Devuelve undefined en los vales previos a
   * la columna `creadoEn`, que no tienen hora que mostrar.
   */
  private horaCreacion(vale: Vale): string | undefined {
    if (!vale.creadoEn) return undefined;
    const fecha = new Date(vale.creadoEn);
    if (Number.isNaN(fecha.getTime())) return undefined;
    return fecha.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** '2026-07-25' → '25 jul 2026', sin pasar por Date (evita corrimientos de zona). */
  private fechaLarga(fecha: string): string {
    const [anio, mes, dia] = (fecha ?? '').split('-');
    if (!anio || !mes || !dia) return fecha ?? '';
    return `${Number(dia)} ${MESES[Number(mes) - 1] ?? mes} ${anio}`;
  }

  /** Lee el logo una sola vez por proceso; `null` marca que no está disponible. */
  private logo(): Buffer | null {
    if (this.logoCache !== undefined) return this.logoCache;
    try {
      this.logoCache = existsSync(LOGO_PATH) ? readFileSync(LOGO_PATH) : null;
      if (!this.logoCache) {
        this.logger.warn(
          `Logo no encontrado en ${LOGO_PATH}; se usa la marca en texto.`,
        );
      }
    } catch (e) {
      this.logger.warn(`No se pudo leer el logo: ${(e as Error).message}`);
      this.logoCache = null;
    }
    return this.logoCache;
  }

  /**
   * Pie de página. Se dibuja por encima del margen inferior (802 pt): si el
   * texto lo cruza, pdfkit abre una página en blanco de más.
   */
  private pie(doc: PDFKit.PDFDocument): void {
    const generado = new Date().toLocaleString('es-CO');
    doc
      .moveTo(LEFT, 782)
      .lineTo(RIGHT, 782)
      .lineWidth(0.75)
      .strokeColor(LINEA)
      .stroke();
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(7)
      .text(
        `Generado el ${generado}  ·  ${EMPRESA}  ·  Control de Producción`,
        LEFT,
        789,
        { align: 'center', width: WIDTH },
      );
  }
}
