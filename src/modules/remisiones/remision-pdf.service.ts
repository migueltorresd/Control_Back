import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { Remision } from './entities/remision.entity';
import { FormaPago } from '../../common/enums/forma-pago.enum';
import { EstadoDocumento } from '../../common/enums/estado-documento.enum';

const EMPRESA = 'Calzado Jhonalje';
const LEMA = 'Fabricamos todo tipo de calzado para damas, caballeros y niños';
const CONTACTO = 'WhatsApp 320 939 4062  ·  Tel. 645 5442  ·  @calzadojhonalje';

// Misma paleta que el vale: el cliente ya aprobó ese formato.
const ORO = '#C9A227';
const TINTA = '#1A1A1A';
const GRIS = '#8C8578';
const LINEA = '#E2DCD0';
const FONDO = '#F5F2EA';

// Geometría A4 con margen de 40 pt
const LEFT = 40;
const RIGHT = 555;
const WIDTH = RIGHT - LEFT; // 515

/**
 * Logo de marca. En desarrollo resuelve a `src/assets/`; compilado, a
 * `dist/assets/` (nest-cli.json copia la carpeta en el build).
 */
const LOGO_PATH = join(__dirname, '..', '..', 'assets', 'logo-scala.png');

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

/** Etiquetas visibles de la forma de pago. El enum viaja en mayúscula ASCII. */
const FORMA_PAGO_LABEL: Record<FormaPago, string> = {
  [FormaPago.EFECTIVO]: 'Efectivo',
  [FormaPago.TRANSFERENCIA]: 'Transferencia',
  [FormaPago.CREDITO]: 'Crédito',
};

/**
 * Texto legal del talonario, transcrito del formato impreso.
 *
 * Va tal cual: es una autorización que el cliente firma, y reescribirla —aunque
 * fuera para mejorar la redacción— cambiaría lo que la persona está aceptando.
 */
const NOTA_LEGAL =
  'Declaro que la información suministrada es verídica y doy mi consentimiento expreso e ' +
  'irrevocable como representante legal autorizado a Calzado Jhonalje para que con fines ' +
  'estadísticos de control y supervisión de información comercial, reporte a centrales de riesgo ' +
  'o cualquier entidad que maneje base de datos con los mismos fines, nacimiento y extinción, ' +
  'cumplimiento e incumplimiento de obligaciones contraídas así como otros atinentes a relaciones ' +
  'comerciales. La presente autorización comprende no solo la facultad de reportar y divulgar sino ' +
  'también la de solicitar información sobre mi o nuestras relaciones comerciales.';

/** Anchos de las cinco columnas del talonario. Suman WIDTH. */
const COL = {
  vale: 78,
  referencia: 197,
  cantidad: 60,
  unitario: 90,
  total: 90,
};

const money = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });

@Injectable()
export class RemisionPdfService {
  private readonly logger = new Logger(RemisionPdfService.name);
  private logoCache?: Buffer | null;

  /** Genera la remisión en PDF y la devuelve como Buffer. */
  generar(remision: Remision): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y = this.encabezado(doc, remision);
      y = this.datosCliente(doc, remision, y);
      y = this.tabla(doc, remision, y);
      y = this.observaciones(doc, remision, y);
      this.pie(doc, y);
      // Al final, para que quede por encima de todo lo demás.
      this.selloAnulada(doc, remision);

      doc.end();
    });
  }

  /**
   * Sello de ANULADA cruzado sobre la hoja.
   *
   * Una remisión anulada se puede seguir descargando —el documento existió y
   * hay que poder consultarlo—, pero no puede salir con la misma cara que una
   * vigente: alguien la reenviaría al cliente como si valiera. El sello va
   * traslúcido para no tapar los datos que se están consultando.
   */
  private selloAnulada(doc: PDFKit.PDFDocument, r: Remision): void {
    if (r.estado !== EstadoDocumento.ANULADO) return;

    doc.save();
    doc.rotate(-30, { origin: [300, 420] });
    doc
      .fillColor('#C0392B')
      .opacity(0.16)
      .font('Helvetica-Bold')
      .fontSize(92)
      .text('ANULADA', 40, 370, { width: 520, align: 'center' });
    doc.opacity(1).restore();

    // El motivo, legible, debajo del sello.
    doc
      .fillColor('#C0392B')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(
        `Documento anulado${r.motivoAnulacion ? `: ${r.motivoAnulacion}` : ''}`,
        LEFT,
        22,
        { width: WIDTH, align: 'center' },
      );
  }

  // ─── Logo, marca y número de remisión ────────────────────────────────────
  private encabezado(doc: PDFKit.PDFDocument, r: Remision): number {
    const logo = this.logo();
    if (logo) {
      try {
        doc.image(logo, LEFT, 36, { fit: [92, 40] });
      } catch {
        this.marcaTextual(doc);
      }
    } else {
      this.marcaTextual(doc);
    }

    // Bloque de marca. El ancho se corta antes de donde empieza el recuadro del
    // consecutivo: sin ese tope, el lema y el contacto se le montaban encima.
    const marcaX = LEFT + 104;
    const cajaX = RIGHT - 148;
    const marcaW = cajaX - marcaX - 14;

    doc
      .fillColor(TINTA)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(EMPRESA, marcaX, 38, { width: marcaW, lineBreak: false });
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(7.5)
      .text(LEMA, marcaX, 57, { width: marcaW, lineBreak: false });

    // Recuadro del consecutivo, arriba a la derecha como en el talonario.
    doc
      .roundedRect(cajaX, 34, 148, 44, 3)
      .lineWidth(1)
      .strokeColor(ORO)
      .stroke();
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(6.5)
      .text('REMISIÓN', cajaX, 41, {
        width: 148,
        align: 'center',
        characterSpacing: 2,
      });
    doc
      .fillColor('#C0392B')
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(r.numero, cajaX, 53, { width: 148, align: 'center' });

    // Contacto y fecha en su propia línea, debajo de todo el bloque superior:
    // así ninguno de los dos compite por el espacio del medio.
    const yPie = 86;
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(7.5)
      .text(CONTACTO, LEFT, yPie, { width: 330, lineBreak: false });
    doc
      .fillColor(TINTA)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(`Fecha: ${this.fechaLarga(r.fecha)}`, RIGHT - 170, yPie, {
        width: 170,
        align: 'right',
        lineBreak: false,
      });

    // Filete que cierra el encabezado y lo separa de los datos del cliente.
    doc
      .moveTo(LEFT, yPie + 14)
      .lineTo(RIGHT, yPie + 14)
      .lineWidth(1)
      .strokeColor(ORO)
      .stroke();

    return yPie + 26;
  }

  private marcaTextual(doc: PDFKit.PDFDocument): void {
    doc
      .fillColor(ORO)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(EMPRESA, LEFT, 44);
  }

  // ─── Señor(es), documento, dirección y forma de pago ─────────────────────
  private datosCliente(
    doc: PDFKit.PDFDocument,
    r: Remision,
    top: number,
  ): number {
    const alto = 62;
    doc.roundedRect(LEFT, top, WIDTH, alto, 3).fillAndStroke(FONDO, LINEA);

    const campo = (
      label: string,
      valor: string,
      x: number,
      y: number,
      w: number,
    ) => {
      doc
        .fillColor(GRIS)
        .font('Helvetica')
        .fontSize(6.5)
        .text(label.toUpperCase(), x, y, {
          characterSpacing: 1,
        });
      doc
        .fillColor(TINTA)
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text(valor || '—', x, y + 10, {
          width: w,
          ellipsis: true,
          lineBreak: false,
        });
    };

    campo('Señor(es)', r.clienteNombre, LEFT + 12, top + 9, 300);
    campo('C.C. ó NIT', r.clienteDocumento || '', LEFT + 330, top + 9, 170);
    campo('Dirección', r.clienteDireccion || '', LEFT + 12, top + 34, 300);
    campo(
      'Forma de pago',
      FORMA_PAGO_LABEL[r.formaPago] || r.formaPago,
      LEFT + 330,
      top + 34,
      170,
    );

    return top + alto + 14;
  }

  // ─── La tabla: vale · referencia (color) · cantidad · unitario · total ───
  private tabla(doc: PDFKit.PDFDocument, r: Remision, top: number): number {
    const xs = {
      vale: LEFT,
      referencia: LEFT + COL.vale,
      cantidad: LEFT + COL.vale + COL.referencia,
      unitario: LEFT + COL.vale + COL.referencia + COL.cantidad,
      total: LEFT + COL.vale + COL.referencia + COL.cantidad + COL.unitario,
    };

    // Encabezado
    const altoCab = 20;
    doc.rect(LEFT, top, WIDTH, altoCab).fill(TINTA);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
    doc.text('VALE', xs.vale + 8, top + 7, { characterSpacing: 0.8 });
    doc.text('REFERENCIA (COLOR)', xs.referencia + 8, top + 7, {
      characterSpacing: 0.8,
    });
    doc.text('CANT.', xs.cantidad, top + 7, {
      width: COL.cantidad - 8,
      align: 'right',
    });
    doc.text('VR. UNIT.', xs.unitario, top + 7, {
      width: COL.unitario - 8,
      align: 'right',
    });
    doc.text('VR. TOTAL', xs.total, top + 7, {
      width: COL.total - 8,
      align: 'right',
    });

    let y = top + altoCab;
    const altoFila = 19;
    let total = 0;

    (r.items || []).forEach((v, i) => {
      const valorTotal = v.pares * v.precioUnitario;
      total += valorTotal;

      if (i % 2 === 1) doc.rect(LEFT, y, WIDTH, altoFila).fill(FONDO);

      const nombre = v.vale?.referencia?.nombre || v.vale?.referenciaId || '—';
      const color = v.vale?.color ? ` (${v.vale.color})` : '';

      doc.fillColor(TINTA).font('Helvetica').fontSize(9);
      doc.text(v.valeId, xs.vale + 8, y + 5.5, {
        width: COL.vale - 12,
        ellipsis: true,
        lineBreak: false,
      });
      doc.text(`${nombre}${color}`, xs.referencia + 8, y + 5.5, {
        width: COL.referencia - 14,
        ellipsis: true,
        lineBreak: false,
      });
      doc.text(String(v.pares), xs.cantidad, y + 5.5, {
        width: COL.cantidad - 8,
        align: 'right',
      });
      doc.text(money(v.precioUnitario), xs.unitario, y + 5.5, {
        width: COL.unitario - 8,
        align: 'right',
      });
      doc.font('Helvetica-Bold').text(money(valorTotal), xs.total, y + 5.5, {
        width: COL.total - 8,
        align: 'right',
      });

      y += altoFila;
      doc
        .moveTo(LEFT, y)
        .lineTo(RIGHT, y)
        .lineWidth(0.5)
        .strokeColor(LINEA)
        .stroke();
    });

    // Marco de la tabla y separadores verticales
    doc
      .rect(LEFT, top, WIDTH, y - top)
      .lineWidth(0.8)
      .strokeColor(LINEA)
      .stroke();
    [xs.referencia, xs.cantidad, xs.unitario, xs.total].forEach((x) => {
      doc
        .moveTo(x, top + altoCab)
        .lineTo(x, y)
        .lineWidth(0.5)
        .strokeColor(LINEA)
        .stroke();
    });

    // Total
    const altoTotal = 24;
    doc
      .rect(xs.cantidad, y, RIGHT - xs.cantidad, altoTotal)
      .fillAndStroke(TINTA, TINTA);
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('TOTAL', xs.cantidad + 8, y + 8);
    doc.fontSize(12).text(money(total), xs.unitario, y + 6, {
      width: COL.unitario + COL.total - 8,
      align: 'right',
    });

    return y + altoTotal + 14;
  }

  private observaciones(
    doc: PDFKit.PDFDocument,
    r: Remision,
    top: number,
  ): number {
    const alto = 44;
    doc
      .roundedRect(LEFT, top, WIDTH, alto, 3)
      .lineWidth(0.8)
      .strokeColor(LINEA)
      .stroke();
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(6.5)
      .text('OBSERVACIONES', LEFT + 10, top + 7, { characterSpacing: 1 });
    doc
      .fillColor(TINTA)
      .font('Helvetica')
      .fontSize(9)
      .text(r.observaciones || '', LEFT + 10, top + 19, {
        width: WIDTH - 20,
        height: 20,
      });

    return top + alto + 16;
  }

  // ─── Nota legal y firma de quien recibe ──────────────────────────────────
  private pie(doc: PDFKit.PDFDocument, top: number): void {
    doc
      .fillColor(TINTA)
      .font('Helvetica-Bold')
      .fontSize(7)
      .text('NOTA', LEFT, top, { characterSpacing: 1 });

    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(6.5)
      .text(NOTA_LEGAL, LEFT, top + 10, {
        width: WIDTH * 0.58,
        align: 'justify',
        lineGap: 0.5,
      });

    // Firma a la derecha del bloque legal, como en el talonario.
    const firmaX = LEFT + WIDTH * 0.62;
    const firmaW = WIDTH - WIDTH * 0.62;
    const lineaY = top + 52;

    doc
      .moveTo(firmaX, lineaY)
      .lineTo(RIGHT, lineaY)
      .lineWidth(0.8)
      .strokeColor(TINTA)
      .stroke();
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(7)
      .text('Firma de quien recibe', firmaX, lineaY + 5, { width: firmaW });

    doc
      .moveTo(firmaX, lineaY + 34)
      .lineTo(RIGHT, lineaY + 34)
      .lineWidth(0.8)
      .strokeColor(TINTA)
      .stroke();
    doc
      .fillColor(GRIS)
      .fontSize(7)
      .text('C.C. No.', firmaX, lineaY + 39, { width: firmaW });
  }

  private fechaLarga(iso: string): string {
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return String(iso);
    return `${String(d).padStart(2, '0')} ${MESES[m - 1]} ${y}`;
  }

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
}
