import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Vale } from './entities/vale.entity';
import { Oficio } from '../../common/enums/oficio.enum';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';

const EMPRESA = 'Scala Leather';
const ACENTO = '#A25C2B'; // marrón cuero, igual que el frontend
const GRIS = '#6B6051';
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
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.encabezado(doc, vale);
      this.datosGenerales(doc, vale);
      this.tablaTallas(doc, vale);
      this.produccionPorEtapa(doc, vale);
      this.pie(doc);

      doc.end();
    });
  }

  private encabezado(doc: PDFKit.PDFDocument, vale: Vale): void {
    doc.fillColor(ACENTO).fontSize(22).font('Helvetica-Bold').text(EMPRESA);
    doc
      .fillColor(GRIS)
      .fontSize(11)
      .font('Helvetica')
      .text('Vale de producción', { continued: false });

    // Código del vale, alineado a la derecha del encabezado
    doc
      .fillColor('#241E17')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(vale.id, 48, 48, { align: 'right' });

    doc.moveTo(48, 92).lineTo(547, 92).strokeColor('#CCC1AD').stroke();
    doc.moveDown(2);
  }

  private datosGenerales(doc: PDFKit.PDFDocument, vale: Vale): void {
    const y = doc.y;
    const col2 = 300;
    const fila = (label: string, valor: string, x: number, yy: number) => {
      doc
        .fillColor(GRIS)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(label.toUpperCase(), x, yy);
      doc
        .fillColor('#241E17')
        .fontSize(13)
        .font('Helvetica')
        .text(valor || '—', x, yy + 12);
    };

    fila('Modelo', vale.referencia?.nombre ?? vale.referenciaId, 48, y);
    fila('Fecha', vale.fecha, col2, y);
    fila('Color', vale.color, 48, y + 42);
    fila('Almacén', vale.almacen, col2, y + 42);
    fila('Altura', vale.altura ?? '—', 48, y + 84);

    doc.y = y + 84 + 36;
    doc.moveDown(0.5);
  }

  private tablaTallas(doc: PDFKit.PDFDocument, vale: Vale): void {
    const tallas = [...(vale.tallas ?? [])].sort((a, b) => a.talla - b.talla);
    const totalPares = tallas.reduce((s, t) => s + t.cantidad, 0);

    this.tituloSeccion(doc, `Tallas — ${totalPares} pares en total`);

    if (tallas.length === 0) {
      doc.fillColor(GRIS).fontSize(11).font('Helvetica').text('Sin tallas.');
      doc.moveDown();
      return;
    }

    const x0 = 48;
    const ancho = 56;
    let x = x0;
    const yTalla = doc.y;
    const yCant = yTalla + 16;

    for (const t of tallas) {
      doc.rect(x, yTalla, ancho, 32).strokeColor('#DED6C6').stroke();
      doc
        .fillColor(GRIS)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(String(t.talla), x, yTalla + 4, { width: ancho, align: 'center' });
      doc
        .fillColor('#241E17')
        .fontSize(13)
        .font('Helvetica-Bold')
        .text(String(t.cantidad), x, yCant, { width: ancho, align: 'center' });
      x += ancho;
      if (x + ancho > 547) {
        x = x0;
      }
    }
    doc.y = yTalla + 48;
    doc.moveDown(0.5);
  }

  private produccionPorEtapa(doc: PDFKit.PDFDocument, vale: Vale): void {
    this.tituloSeccion(doc, 'Producción por etapa');

    for (const etapa of ORDEN_ETAPAS) {
      const regs = (vale.produccion ?? []).filter((r) => r.etapa === etapa);

      doc
        .fillColor(ACENTO)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(etapa, { continued: false });

      if (regs.length === 0) {
        doc
          .fillColor(GRIS)
          .fontSize(10)
          .font('Helvetica-Oblique')
          .text('  Sin registros todavía.');
      } else {
        for (const r of regs) {
          const nombre = r.operario?.nombre ?? r.operarioId;
          const estado = ESTADO_TXT[r.estado] ?? r.estado;
          doc
            .fillColor('#241E17')
            .fontSize(10.5)
            .font('Helvetica')
            .text(`  • ${nombre} — ${r.pares} pares — ${estado}`);
        }
      }
      doc.moveDown(0.6);
      if (doc.y > 740) doc.addPage();
    }
  }

  private tituloSeccion(doc: PDFKit.PDFDocument, texto: string): void {
    doc
      .fillColor('#241E17')
      .fontSize(13)
      .font('Helvetica-Bold')
      .text(texto);
    doc.moveDown(0.4);
  }

  private pie(doc: PDFKit.PDFDocument): void {
    const generado = new Date().toLocaleString('es-CO');
    doc
      .fillColor(GRIS)
      .fontSize(8)
      .font('Helvetica')
      .text(`Generado el ${generado} · ${EMPRESA} · Control de Producción`, 48, 800, {
        align: 'center',
        width: 499,
      });
  }
}
