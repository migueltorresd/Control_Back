import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material } from '../entities/material.entity';
import { Referencia } from '../entities/referencia.entity';
import { Operario } from '../entities/operario.entity';
import { Vale } from '../entities/vale.entity';
import { ProduccionReg } from '../entities/produccion-reg.entity';
import { Venta } from '../entities/venta.entity';
import { Pago } from '../entities/pago.entity';

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
      { id: 'MT-01', nombre: 'Cuero', proveedor: 'Curtiduría León', unidad: 'pie²', precio: 12000 },
      { id: 'MT-02', nombre: 'Suela', proveedor: 'Suelas Guanajuato', unidad: 'par', precio: 9000 },
      { id: 'MT-03', nombre: 'Cordón', proveedor: 'Accesorios Express', unidad: 'unidad', precio: 1500 },
      { id: 'MT-04', nombre: 'Pegante', proveedor: 'Químicos del Calzado', unidad: 'kg', precio: 28000 },
      { id: 'MT-05', nombre: 'Forro', proveedor: 'Pieles del Bajío', unidad: 'par', precio: 4500 },
    ];
    await this.materialRepo.save(materiales);

    // 2. Referencias
    const referencias = [
      { id: 'REF-001', nombre: 'Air Runner Pro', linea: 'Deportivo', precioVenta: 95000, tarifas: { Cortador: 1200, Guarnecedor: 3500, Solador: 2800, Finizaje: 1800 }, receta: { 'MT-01': 1.4, 'MT-02': 1, 'MT-03': 2, 'MT-04': 0.05 } },
      { id: 'REF-002', nombre: 'Classic Oxford', linea: 'Vestir', precioVenta: 140000, tarifas: { Cortador: 1500, Guarnecedor: 4200, Solador: 3200, Finizaje: 2100 }, receta: { 'MT-01': 1.8, 'MT-02': 1, 'MT-05': 1, 'MT-04': 0.06 } },
      { id: 'REF-003', nombre: 'Sport Flex X', linea: 'Casual', precioVenta: 78000, tarifas: { Cortador: 1000, Guarnecedor: 3000, Solador: 2500, Finizaje: 1500 }, receta: { 'MT-01': 1.2, 'MT-02': 1, 'MT-03': 2 } },
    ];
    await this.referenciaRepo.save(referencias);

    // 3. Operarios
    const operarios = [
      { id: 'OP-01', nombre: 'Pedro Ramírez', oficio: 'Cortador', antiguedad: 2019 },
      { id: 'OP-02', nombre: 'José Martínez', oficio: 'Cortador', antiguedad: 2021 },
      { id: 'OP-03', nombre: 'Luis Gómez', oficio: 'Guarnecedor', antiguedad: 2017 },
      { id: 'OP-04', nombre: 'Carmen Díaz', oficio: 'Guarnecedor', antiguedad: 2020 },
      { id: 'OP-05', nombre: 'Marta Ríos', oficio: 'Solador', antiguedad: 2016 },
      { id: 'OP-06', nombre: 'Andrea Soto', oficio: 'Finizaje', antiguedad: 2022 },
    ];
    await this.operarioRepo.save(operarios);

    // 4. Vales
    const vales = [
      { vale: 'V-0001', fecha: '2026-06-01', almacen: 'Principal', refId: 'REF-001', color: 'Negro', altura: 'Media', tallas: { 38: 6, 39: 8, 40: 10, 41: 8, 42: 6, 43: 2 } },
      { vale: 'V-0002', fecha: '2026-06-03', almacen: 'Principal', refId: 'REF-002', color: 'Café', altura: 'Alta', tallas: { 39: 4, 40: 6, 41: 6, 42: 4 } },
    ];
    await this.valeRepo.save(vales);

    // 5. Producción Registros
    const prodRegs = [
      { valeId: 'V-0001', etapa: 'Cortador', operarioId: 'OP-01', pares: 40, estado: 'pagado' },
      { valeId: 'V-0001', etapa: 'Guarnecedor', operarioId: 'OP-03', pares: 25, estado: 'aprobado' },
      { valeId: 'V-0001', etapa: 'Guarnecedor', operarioId: 'OP-04', pares: 15, estado: 'registrado' },
      { valeId: 'V-0001', etapa: 'Solador', operarioId: 'OP-05', pares: 40, estado: 'pagado' },
      { valeId: 'V-0001', etapa: 'Finizaje', operarioId: 'OP-06', pares: 35, estado: 'pagado' },
      { valeId: 'V-0002', etapa: 'Cortador', operarioId: 'OP-02', pares: 20, estado: 'aprobado' },
    ];
    await this.produccionRegRepo.save(prodRegs);

    // 6. Pagos
    const pagos = [
      { id: 'PG-seed1', fecha: '2026-06-02', operarioId: 'OP-01', valeId: 'V-0001', etapa: 'Cortador', pares: 40, monto: 48000, refId: 'REF-001' }
    ];
    await this.pagoRepo.save(pagos);

    // 7. Ventas
    const ventas = [
      { id: 'VT-seed1', fecha: '2026-06-05', valeId: 'V-0001', refId: 'REF-001', color: 'Negro', pares: 10, precio: 95000, monto: 950000 }
    ];
    await this.ventaRepo.save(ventas);

    console.log('Seeding completed successfully!');
  }
}
