import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Vale } from './entities/vale.entity';
import { Oficio } from '../../common/enums/oficio.enum';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';

const EMPRESA = 'Scala Leather';

// Paleta — marrón cuero como acento, sobre tintas cálidas neutras
const ACENTO = '#A25C2B';
const ACENTO_CLARO = '#F2E9E0';
const TINTA = '#241E17';
const GRIS = '#7A6F5E';
const LINEA = '#E5DECF';
const LINEA_FUERTE = '#CFC4AE';
const FONDO = '#FAF7F2';

// Geometría de página A4 con margen de 40 pt
const LEFT = 40;
const RIGHT = 555;
const WIDTH = RIGHT - LEFT; // 515

const ORDEN_ETAPAS: Oficio[] = [
  Oficio.CORTADOR,
  Oficio.GUARNECEDOR,
  Oficio.SOLADOR,
  Oficio.FINIZAJE,
];
const ESTADO_TXT: Record<EstadoProduccion, string> = {
  [EstadoProduccion.REGISTRADO]: 'Por revisar',
  [EstadoProduccion.APROBADO]: 'Revisado OK',
  [EstadoProduccion.PAGADO]: 'Pagado',
};

@Injectable()
export class ValePdfService {
  /** Genera el PDF de un vale de producción y lo devuelve como Buffer. */
  generar(vale: Vale): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y = this.encabezado(doc, vale);
      y = this.datosGenerales(doc, vale, y);
      y = this.tablaTallas(doc, vale, y);
      this.produccionPorEtapa(doc, vale, y);
      this.pie(doc);

      doc.end();
    });
  }

  // ─── Encabezado ──────────────────────────────────────────────────────────
  private encabezado(doc: PDFKit.PDFDocument, vale: Vale): number {
    doc
      .fillColor(ACENTO)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(EMPRESA.toUpperCase(), LEFT, 46, { characterSpacing: 0.5 });
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(7.5)
      .text('VALE DE PRODUCCIÓN', LEFT, 65, { characterSpacing: 2.5 });

    // Tarjeta del código del vale, alineada a la derecha
    const boxW = 132;
    const boxH = 42;
    const boxX = RIGHT - boxW;
    const boxY = 40;
    doc
      .roundedRect(boxX, boxY, boxW, boxH, 7)
      .lineWidth(1)
      .fillAndStroke('#FFFFFF', ACENTO);
    doc
      .fillColor(GRIS)
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .text('VALE', boxX, boxY + 7, {
        width: boxW,
        align: 'center',
        characterSpacing: 2,
      });
    doc
      .fillColor(ACENTO)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(vale.id, boxX, boxY + 18, { width: boxW, align: 'center' });

    const yRule = 96;
    doc
      .moveTo(LEFT, yRule)
      .lineTo(RIGHT, yRule)
      .lineWidth(1)
      .strokeColor(LINEA_FUERTE)
      .stroke();

    return yRule + 18;
  }

  // ─── Datos generales (tarjeta) ───────────────────────────────────────────
  private datosGenerales(
    doc: PDFKit.PDFDocument,
    vale: Vale,
    y: number,
  ): number {
    const cardH = 72;
    doc
      .roundedRect(LEFT, y, WIDTH, cardH, 8)
      .lineWidth(1)
      .fillAndStroke(FONDO, LINEA);

    const totalPares = (vale.tallas ?? []).reduce((s, t) => s + t.cantidad, 0);
    const colW = WIDTH / 3;
    const padX = 18;
    const r1 = y + 15;
    const r2 = y + 42;

    const campo = (label: string, valor: string, col: number, yy: number) => {
      const x = LEFT + padX + col * colW;
      doc
        .fillColor(GRIS)
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .text(label.toUpperCase(), x, yy, { characterSpacing: 1.5 });
      doc
        .fillColor(TINTA)
        .font('Helvetica')
        .fontSize(9.5)
        .text(valor || '—', x, yy + 10, { width: colW - padX - 6 });
    };

    campo('Modelo', vale.referencia?.nombre ?? vale.referenciaId, 0, r1);
    campo('Color', vale.color, 1, r1);
    campo('Altura', vale.altura ?? '—', 2, r1);
    campo('Almacén', vale.almacen, 0, r2);
    campo('Fecha', vale.fecha, 1, r2);
    campo('Total de pares', String(totalPares), 2, r2);

    return y + cardH + 26;
  }

  // ─── Tallas ──────────────────────────────────────────────────────────────
  private tablaTallas(doc: PDFKit.PDFDocument, vale: Vale, y: number): number {
    const tallas = [...(vale.tallas ?? [])].sort((a, b) => a.talla - b.talla);
    const totalPares = tallas.reduce((s, t) => s + t.cantidad, 0);

    let cursorY = this.barraSeccion(doc, y, 'Tallas', `${totalPares} pares`);

    if (tallas.length === 0) {
      doc
        .fillColor(GRIS)
        .font('Helvetica-Oblique')
        .fontSize(10.5)
        .text('Sin tallas registradas.', LEFT, cursorY);
      return cursorY + 28;
    }

    const cellW = 46;
    const cellH = 40;
    const gap = 6;
    const perRow = Math.floor((WIDTH + gap) / (cellW + gap));

    // Celdas de talla + una celda final de TOTAL con acento
    const items = [
      ...tallas.map((t) => ({
        arriba: String(t.talla),
        abajo: String(t.cantidad),
        total: false,
      })),
      { arriba: 'TOTAL', abajo: String(totalPares), total: true },
    ];

    let x = LEFT;
    let col = 0;
    for (const it of items) {
      if (col === perRow) {
        col = 0;
        x = LEFT;
        cursorY += cellH + gap;
      }
      const fill = it.total ? ACENTO : FONDO;
      const stroke = it.total ? ACENTO : LINEA;
      doc
        .roundedRect(x, cursorY, cellW, cellH, 6)
        .lineWidth(1)
        .fillAndStroke(fill, stroke);
      doc
        .fillColor(it.total ? ACENTO_CLARO : GRIS)
        .font('Helvetica-Bold')
        .fontSize(7)
        .text(it.arriba, x, cursorY + 7, { width: cellW, align: 'center' });
      doc
        .fillColor(it.total ? '#FFFFFF' : TINTA)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(it.abajo, x, cursorY + 19, { width: cellW, align: 'center' });
      x += cellW + gap;
      col++;
    }

    return cursorY + cellH + 28;
  }

  // ─── Producción por etapa (con firma) ────────────────────────────────────
  private produccionPorEtapa(
    doc: PDFKit.PDFDocument,
    vale: Vale,
    y: number,
  ): void {
    let cursorY = this.barraSeccion(doc, y, 'Producción por etapa');

    for (const etapa of ORDEN_ETAPAS) {
      const regs = (vale.produccion ?? []).filter((r) => r.etapa === etapa);
      const paresEtapa = regs.reduce((s, r) => s + r.pares, 0);
      const altoBloque = Math.max(50, 30 + regs.length * 12);

      if (cursorY + altoBloque > 770) {
        doc.addPage();
        cursorY = 48;
      }

      // Nombre de la etapa
      doc
        .fillColor(ACENTO)
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text(etapa, LEFT, cursorY + 5, { width: 150 });

      // Registros existentes (o aviso de vacío)
      if (regs.length === 0) {
        doc
          .fillColor(GRIS)
          .font('Helvetica-Oblique')
          .fontSize(8)
          .text('Sin registros todavía', LEFT, cursorY + 21, { width: 150 });
      } else {
        let yReg = cursorY + 21;
        for (const r of regs) {
          const nombre = r.operario?.nombre ?? r.operarioId;
          const estado = ESTADO_TXT[r.estado] ?? r.estado;
          doc
            .fillColor(GRIS)
            .font('Helvetica')
            .fontSize(8)
            .text(`${nombre} · ${r.pares} pares · ${estado}`, LEFT, yReg, {
              width: 230,
            });
          yReg += 11;
        }
      }

      // Campo "Pares" (valor si hay producción, línea si no)
      const xPares = 300;
      doc
        .fillColor(GRIS)
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .text('PARES', xPares, cursorY + 5, { characterSpacing: 1.5 });
      if (paresEtapa > 0) {
        doc
          .fillColor(TINTA)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(String(paresEtapa), xPares, cursorY + 15);
      } else {
        this.lineaCampo(doc, xPares, cursorY + 24, 70);
      }

      // Campo "Firma" (siempre en blanco, para el taller)
      const xFirma = 410;
      doc
        .fillColor(GRIS)
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .text('FIRMA', xFirma, cursorY + 5, { characterSpacing: 1.5 });
      this.lineaCampo(doc, xFirma, cursorY + 24, RIGHT - xFirma);

      // Separador inferior del bloque
      const yLinea = cursorY + altoBloque - 6;
      doc
        .moveTo(LEFT, yLinea)
        .lineTo(RIGHT, yLinea)
        .lineWidth(0.75)
        .strokeColor(LINEA)
        .stroke();

      cursorY += altoBloque;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Título de sección: barra de acento + texto, con un dato opcional a la derecha. */
  private barraSeccion(
    doc: PDFKit.PDFDocument,
    y: number,
    titulo: string,
    derecha?: string,
  ): number {
    doc.rect(LEFT, y + 1, 3, 11).fillColor(ACENTO).fill();
    doc
      .fillColor(TINTA)
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(titulo.toUpperCase(), LEFT + 10, y, { characterSpacing: 1 });
    if (derecha) {
      doc
        .fillColor(GRIS)
        .font('Helvetica')
        .fontSize(8.5)
        .text(derecha, LEFT, y + 1, { width: WIDTH, align: 'right' });
    }
    return y + 23;
  }

  /** Línea fina para rellenar a mano (pares, firma). */
  private lineaCampo(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    ancho: number,
  ): void {
    doc
      .moveTo(x, y)
      .lineTo(x + ancho, y)
      .lineWidth(0.75)
      .strokeColor(LINEA_FUERTE)
      .stroke();
  }

  private pie(doc: PDFKit.PDFDocument): void {
    const generado = new Date().toLocaleString('es-CO');
    doc
      .moveTo(LEFT, 806)
      .lineTo(RIGHT, 806)
      .lineWidth(0.75)
      .strokeColor(LINEA)
      .stroke();
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(7.5)
      .text(
        `Generado el ${generado}  ·  ${EMPRESA}  ·  Control de Producción`,
        LEFT,
        812,
        { align: 'center', width: WIDTH },
      );
  }
}
