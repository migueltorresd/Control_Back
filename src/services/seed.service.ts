import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Entities modularizados
import { Material } from '../modules/materiales/entities/material.entity';
import { Referencia } from '../modules/referencias/entities/referencia.entity';
import { Operario } from '../modules/operarios/entities/operario.entity';
import { Vale } from '../modules/vales/entities/vale.entity';
import { ProduccionReg } from '../modules/vales/entities/produccion-reg.entity';
import { Venta } from '../modules/ventas/entities/venta.entity';
import { Pago } from '../modules/pagos/entities/pago.entity';

// Enums
import { Oficio } from '../common/enums/oficio.enum';
import { EstadoProduccion } from '../common/enums/estado-produccion.enum';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Material)
    private readonly materialRepo: Repository<Material>,
    @InjectRepository(Referencia)
    private readonly referenciaRepo: Repository<Referencia>,
    @InjectRepository(Operario)
    private readonly operarioRepo: Repository<Operario>,
    @InjectRepository(Vale)
    private readonly valeRepo: Repository<Vale>,
    @InjectRepository(ProduccionReg)
    private readonly produccionRegRepo: Repository<ProduccionReg>,
    @InjectRepository(Venta)
    private readonly ventaRepo: Repository<Venta>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    const materialsCount = await this.materialRepo.count();
    if (materialsCount > 0) {
      console.log('Database already has data. Skipping seed.');
      return;
    }

    console.log('Seeding initial data...');

    // 1. Materiales
    const materiales = [
      {
        id: 'MT-01',
        nombre: 'Cuero',
        proveedor: 'Curtiduría León',
        unidad: 'pie²',
        precio: 12000,
      },
      {
        id: 'MT-02',
        nombre: 'Suela',
        proveedor: 'Suelas Guanajuato',
        unidad: 'par',
        precio: 9000,
      },
      {
        id: 'MT-03',
        nombre: 'Cordón',
        proveedor: 'Accesorios Express',
        unidad: 'unidad',
        precio: 1500,
      },
      {
        id: 'MT-04',
        nombre: 'Pegante',
        proveedor: 'Químicos del Calzado',
        unidad: 'kg',
        precio: 28000,
      },
      {
        id: 'MT-05',
        nombre: 'Forro',
        proveedor: 'Pieles del Bajío',
        unidad: 'par',
        precio: 4500,
      },
    ];
    await this.materialRepo.save(materiales);

    // 2. Referencias (con tarifas y receta en cascada)
    const referencias = [
      this.referenciaRepo.create({
        id: 'REF-001',
        nombre: 'Air Runner Pro',
        linea: 'Deportivo',
        precioVenta: 95000,
        tarifas: [
          { oficio: Oficio.CORTADOR, valor: 1200 },
          { oficio: Oficio.GUARNECEDOR, valor: 3500 },
          { oficio: Oficio.SOLADOR, valor: 2800 },
          { oficio: Oficio.FINIZAJE, valor: 1800 },
        ],
        receta: [
          { material: { id: 'MT-01' }, cantidad: 1.4 },
          { material: { id: 'MT-02' }, cantidad: 1.0 },
          { material: { id: 'MT-03' }, cantidad: 2.0 },
          { material: { id: 'MT-04' }, cantidad: 0.05 },
        ],
      }),
      this.referenciaRepo.create({
        id: 'REF-002',
        nombre: 'Classic Oxford',
        linea: 'Vestir',
        precioVenta: 140000,
        tarifas: [
          { oficio: Oficio.CORTADOR, valor: 1500 },
          { oficio: Oficio.GUARNECEDOR, valor: 4200 },
          { oficio: Oficio.SOLADOR, valor: 3200 },
          { oficio: Oficio.FINIZAJE, valor: 2100 },
        ],
        receta: [
          { material: { id: 'MT-01' }, cantidad: 1.8 },
          { material: { id: 'MT-02' }, cantidad: 1.0 },
          { material: { id: 'MT-05' }, cantidad: 1.0 },
          { material: { id: 'MT-04' }, cantidad: 0.06 },
        ],
      }),
      this.referenciaRepo.create({
        id: 'REF-003',
        nombre: 'Sport Flex X',
        linea: 'Casual',
        precioVenta: 78000,
        tarifas: [
          { oficio: Oficio.CORTADOR, valor: 1000 },
          { oficio: Oficio.GUARNECEDOR, valor: 3000 },
          { oficio: Oficio.SOLADOR, valor: 2500 },
          { oficio: Oficio.FINIZAJE, valor: 1500 },
        ],
        receta: [
          { material: { id: 'MT-01' }, cantidad: 1.2 },
          { material: { id: 'MT-02' }, cantidad: 1.0 },
          { material: { id: 'MT-03' }, cantidad: 2.0 },
        ],
      }),
    ];
    await this.referenciaRepo.save(referencias);

    // 3. Operarios
    const operarios = [
      {
        id: 'OP-01',
        nombre: 'Pedro Ramírez',
        oficio: Oficio.CORTADOR,
        antiguedad: 2019,
      },
      {
        id: 'OP-02',
        nombre: 'José Martínez',
        oficio: Oficio.CORTADOR,
        antiguedad: 2021,
      },
      {
        id: 'OP-03',
        nombre: 'Luis Gómez',
        oficio: Oficio.GUARNECEDOR,
        antiguedad: 2017,
      },
      {
        id: 'OP-04',
        nombre: 'Carmen Díaz',
        oficio: Oficio.GUARNECEDOR,
        antiguedad: 2020,
      },
      {
        id: 'OP-05',
        nombre: 'Marta Ríos',
        oficio: Oficio.SOLADOR,
        antiguedad: 2016,
      },
      {
        id: 'OP-06',
        nombre: 'Andrea Soto',
        oficio: Oficio.FINIZAJE,
        antiguedad: 2022,
      },
    ];
    await this.operarioRepo.save(operarios);

    // 4. Vales (con tallas en cascada)
    const vales = [
      this.valeRepo.create({
        id: 'V-0001',
        fecha: '2026-06-01',
        almacen: 'Principal',
        referenciaId: 'REF-001',
        color: 'Negro',
        altura: 'Media',
        tallas: [
          { talla: 38, cantidad: 6 },
          { talla: 39, cantidad: 8 },
          { talla: 40, cantidad: 10 },
          { talla: 41, cantidad: 8 },
          { talla: 42, cantidad: 6 },
          { talla: 43, cantidad: 2 },
        ],
      }),
      this.valeRepo.create({
        id: 'V-0002',
        fecha: '2026-06-03',
        almacen: 'Principal',
        referenciaId: 'REF-002',
        color: 'Café',
        altura: 'Alta',
        tallas: [
          { talla: 39, cantidad: 4 },
          { talla: 40, cantidad: 6 },
          { talla: 41, cantidad: 6 },
          { talla: 42, cantidad: 4 },
        ],
      }),
    ];
    await this.valeRepo.save(vales);

    // 5. Producción Registros
    const prodRegs = [
      {
        valeId: 'V-0001',
        etapa: Oficio.CORTADOR,
        operarioId: 'OP-01',
        pares: 40,
        estado: EstadoProduccion.PAGADO,
        montoPagado: 48000,
      },
      {
        valeId: 'V-0001',
        etapa: Oficio.GUARNECEDOR,
        operarioId: 'OP-03',
        pares: 25,
        estado: EstadoProduccion.APROBADO,
        montoPagado: 87500,
      },
      {
        valeId: 'V-0001',
        etapa: Oficio.GUARNECEDOR,
        operarioId: 'OP-04',
        pares: 15,
        estado: EstadoProduccion.REGISTRADO,
        montoPagado: 0,
      },
      {
        valeId: 'V-0001',
        etapa: Oficio.SOLADOR,
        operarioId: 'OP-05',
        pares: 40,
        estado: EstadoProduccion.PAGADO,
        montoPagado: 112000,
      },
      {
        valeId: 'V-0001',
        etapa: Oficio.FINIZAJE,
        operarioId: 'OP-06',
        pares: 35,
        estado: EstadoProduccion.PAGADO,
        montoPagado: 63000,
      },
      {
        valeId: 'V-0002',
        etapa: Oficio.CORTADOR,
        operarioId: 'OP-02',
        pares: 20,
        estado: EstadoProduccion.APROBADO,
        montoPagado: 30000,
      },
    ];
    await this.produccionRegRepo.save(prodRegs);

    // 6. Pagos
    const pagos = [
      {
        id: 'PG-seed1',
        fecha: '2026-06-02',
        operarioId: 'OP-01',
        valeId: 'V-0001',
        etapa: 'Cortador',
        pares: 40,
        monto: 48000,
        refId: 'REF-001',
      },
    ];
    await this.pagoRepo.save(pagos);

    // 7. Ventas (con el nuevo esquema normalizado)
    const ventas = [
      {
        id: 'VT-seed1',
        fecha: '2026-06-05',
        valeId: 'V-0001',
        pares: 10,
        precioUnitario: 95000,
      },
    ];
    await this.ventaRepo.save(ventas);

    console.log('Seeding completed successfully!');
  }
}
