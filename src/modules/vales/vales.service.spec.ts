import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ValesService } from './vales.service';
import { ValesRepository } from './vales.repository';
import { ReferenciasService } from '../referencias/referencias.service';
import { AdministrativosService } from '../administrativos/administrativos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Vale } from './entities/vale.entity';
import { EstadoVale } from '../../common/enums/estado-vale.enum';
import { EstadoProduccion } from '../../common/enums/estado-produccion.enum';
import { Oficio } from '../../common/enums/oficio.enum';

describe('ValesService', () => {
  let service: ValesService;

  const manager = {} as never;

  const repository = {
    findAllWithRelations: jest.fn(),
    findByIdWithRelations: jest.fn(),
    findByIdWithRelationsEn: jest.fn(),
    crearConRelaciones: jest.fn(),
    aplicarModificacion: jest.fn(),
    update: jest.fn(),
    stockDisponible: jest.fn(),
    dataSource: {
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
    },
  };
  const referenciasService = { findOne: jest.fn() };
  const administrativosService = { assertSeleccionable: jest.fn() };
  const auditoriaService = { registrar: jest.fn() };

  /** Vale vigente, sin producción, listo para que cada test lo deforme. */
  const valeBase = (extra: Partial<Vale> = {}): Vale =>
    ({
      id: 'V-0001',
      fecha: '2026-08-10',
      almacen: 'Principal',
      color: 'Negro',
      altura: 'Media',
      referenciaId: 'REF-001',
      creadoPorId: 'ADM-01',
      estado: EstadoVale.ACTIVO,
      motivoAnulacion: null,
      tallas: [
        { talla: 40, cantidad: 6 },
        { talla: 41, cantidad: 4 },
      ],
      produccion: [],
      ...extra,
    }) as Vale;

  const registro = (extra: Record<string, unknown> = {}) =>
    ({
      id: 'reg-1',
      etapa: Oficio.CORTADOR,
      operarioId: 'OP-01',
      pares: 5,
      estado: EstadoProduccion.REGISTRADO,
      montoPagado: 0,
      ...extra,
    }) as never;

  beforeEach(async () => {
    jest.resetAllMocks();
    repository.dataSource.transaction.mockImplementation(
      (cb: (m: unknown) => unknown) => cb(manager),
    );
    const module = await Test.createTestingModule({
      providers: [
        ValesService,
        { provide: ValesRepository, useValue: repository },
        { provide: ReferenciasService, useValue: referenciasService },
        {
          provide: AdministrativosService,
          useValue: administrativosService,
        },
        { provide: AuditoriaService, useValue: auditoriaService },
      ],
    }).compile();
    service = module.get(ValesService);
  });

  // ── alta (comportamiento previo, no debe cambiar) ──────────────────────────

  it('findOne inexistente → 404', async () => {
    repository.findByIdWithRelations.mockResolvedValue(null);
    await expect(service.findOne('V-9999')).rejects.toThrow(NotFoundException);
  });

  it('create con referencia inexistente → 404 y no crea nada', async () => {
    referenciasService.findOne.mockRejectedValue(new NotFoundException());

    await expect(
      service.create({
        fecha: '2026-06-11',
        almacen: 'Principal',
        color: 'Negro',
        altura: 'Media',
        referenciaId: 'REF-NOPE',
        tallas: [{ talla: 40, cantidad: 5 }],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.crearConRelaciones).not.toHaveBeenCalled();
  });

  it('create feliz delega al repositorio transaccional', async () => {
    referenciasService.findOne.mockResolvedValue({ id: 'REF-001' });
    repository.crearConRelaciones.mockResolvedValue({ id: 'V-0003' });

    const result = await service.create({
      fecha: '2026-06-11',
      almacen: 'Principal',
      color: 'Negro',
      altura: 'Media',
      referenciaId: 'REF-001',
      tallas: [{ talla: 40, cantidad: 5 }],
    });

    expect(repository.crearConRelaciones).toHaveBeenCalledWith(
      expect.objectContaining({ referenciaId: 'REF-001' }),
      [{ talla: 40, cantidad: 5 }],
    );
    expect(result.id).toBe('V-0003');
  });

  it('create con administrativo inactivo → 400 y no crea nada', async () => {
    referenciasService.findOne.mockResolvedValue({ id: 'REF-001' });
    administrativosService.assertSeleccionable.mockRejectedValue(
      new BadRequestException(),
    );

    await expect(
      service.create({
        fecha: '2026-06-11',
        almacen: 'Principal',
        color: 'Negro',
        altura: 'Media',
        referenciaId: 'REF-001',
        creadoPorId: 'ADM-01',
        tallas: [{ talla: 40, cantidad: 5 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.crearConRelaciones).not.toHaveBeenCalled();
  });

  it('create sin responsable guarda creadoPorId en null', async () => {
    referenciasService.findOne.mockResolvedValue({ id: 'REF-001' });
    repository.crearConRelaciones.mockResolvedValue({ id: 'V-0003' });

    await service.create({
      fecha: '2026-06-11',
      almacen: 'Principal',
      color: 'Negro',
      altura: 'Media',
      referenciaId: 'REF-001',
      tallas: [{ talla: 40, cantidad: 5 }],
    });

    expect(administrativosService.assertSeleccionable).not.toHaveBeenCalled();
    expect(repository.crearConRelaciones).toHaveBeenCalledWith(
      expect.objectContaining({ creadoPorId: null }),
      [{ talla: 40, cantidad: 5 }],
    );
  });

  it('asignarResponsable valida el vale y el administrativo antes de guardar', async () => {
    repository.findByIdWithRelations.mockResolvedValue(valeBase());

    await service.asignarResponsable('V-0001', 'ADM-02');

    expect(administrativosService.assertSeleccionable).toHaveBeenCalledWith(
      'ADM-02',
    );
    expect(repository.update).toHaveBeenCalledWith('V-0001', {
      creadoPorId: 'ADM-02',
    });
  });

  it('asignarResponsable sobre un vale anulado → 400', async () => {
    repository.findByIdWithRelations.mockResolvedValue(
      valeBase({
        estado: EstadoVale.ANULADO,
        motivoAnulacion: 'error de carga',
      }),
    );

    await expect(
      service.asignarResponsable('V-0001', 'ADM-02'),
    ).rejects.toThrow(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  // ── modificación ───────────────────────────────────────────────────────────

  describe('modificar', () => {
    const dtoMin = { modificadoPorId: 'ADM-02' };

    it('con un solo registro PAGADO → 400 y no toca nada', async () => {
      repository.findByIdWithRelations.mockResolvedValue(
        valeBase({
          produccion: [
            registro({ estado: EstadoProduccion.REGISTRADO }),
            registro({ id: 'reg-2', estado: EstadoProduccion.PAGADO }),
          ],
        }),
      );

      await expect(
        service.modificar('V-0001', { ...dtoMin, color: 'Rojo' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.aplicarModificacion).not.toHaveBeenCalled();
      expect(auditoriaService.registrar).not.toHaveBeenCalled();
    });

    it('sobre un vale anulado → 400', async () => {
      repository.findByIdWithRelations.mockResolvedValue(
        valeBase({ estado: EstadoVale.ANULADO, motivoAnulacion: 'duplicado' }),
      );

      await expect(
        service.modificar('V-0001', { ...dtoMin, color: 'Rojo' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.aplicarModificacion).not.toHaveBeenCalled();
    });

    it('bajando las tallas por debajo de lo ya registrado en una etapa → 400', async () => {
      // 10 pares de cupo, 8 ya registrados en Cortador: no se puede dejar 6.
      repository.findByIdWithRelations.mockResolvedValue(
        valeBase({
          produccion: [
            registro({ pares: 5 }),
            registro({ id: 'reg-2', operarioId: 'OP-02', pares: 3 }),
          ],
        }),
      );
      administrativosService.assertSeleccionable.mockResolvedValue(undefined);

      await expect(
        service.modificar(
          'V-0001',
          { ...dtoMin, tallas: [{ talla: 40, cantidad: 6 }] },
          'admin',
        ),
      ).rejects.toThrow(/ya tiene 8 pares registrados/);
      expect(repository.aplicarModificacion).not.toHaveBeenCalled();
    });

    it('las asignaciones sin pares no bloquean la baja de cupo', async () => {
      repository.findByIdWithRelations.mockResolvedValue(
        valeBase({
          produccion: [
            registro({ pares: null, estado: EstadoProduccion.ASIGNADO }),
          ],
        }),
      );
      administrativosService.assertSeleccionable.mockResolvedValue(undefined);
      repository.findByIdWithRelationsEn.mockResolvedValue(valeBase());

      await service.modificar(
        'V-0001',
        { ...dtoMin, tallas: [{ talla: 40, cantidad: 1 }] },
        'admin',
      );

      expect(repository.aplicarModificacion).toHaveBeenCalled();
    });

    it('tallas idénticas no se auditan como cambio ni reescriben las filas', async () => {
      repository.findByIdWithRelations.mockResolvedValue(valeBase());
      administrativosService.assertSeleccionable.mockResolvedValue(undefined);
      repository.findByIdWithRelationsEn.mockResolvedValue(valeBase());

      // El formulario reenvía el cuadro completo aunque solo se toque el color.
      await service.modificar(
        'V-0001',
        {
          ...dtoMin,
          color: 'Rojo',
          tallas: [
            { talla: 41, cantidad: 4 },
            { talla: 40, cantidad: 6 },
          ],
        },
        'miguel',
      );

      // Tercer argumento undefined: no se borran ni reinsertan las tallas.
      expect(repository.aplicarModificacion).toHaveBeenCalledWith(
        'V-0001',
        expect.objectContaining({ color: 'Rojo' }),
        undefined,
        manager,
      );
      expect(auditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          detalle: expect.objectContaining({ campos: ['color'] }) as unknown,
        }),
        manager,
      );
    });

    it('reenviar solo las tallas sin tocarlas → 400', async () => {
      repository.findByIdWithRelations.mockResolvedValue(valeBase());
      administrativosService.assertSeleccionable.mockResolvedValue(undefined);

      await expect(
        service.modificar(
          'V-0001',
          {
            ...dtoMin,
            tallas: [
              { talla: 40, cantidad: 6 },
              { talla: 41, cantidad: 4 },
            ],
          },
          'miguel',
        ),
      ).rejects.toThrow(/no cambia ningún dato/);
    });

    it('sin ningún cambio real → 400 (no ensucia el historial)', async () => {
      repository.findByIdWithRelations.mockResolvedValue(valeBase());
      administrativosService.assertSeleccionable.mockResolvedValue(undefined);

      await expect(
        service.modificar(
          'V-0001',
          { ...dtoMin, color: 'Negro', almacen: 'Principal' },
          'admin',
        ),
      ).rejects.toThrow(/no cambia ningún dato/);
      expect(auditoriaService.registrar).not.toHaveBeenCalled();
    });

    it('feliz: aplica solo los campos cambiados y audita el antes/después', async () => {
      repository.findByIdWithRelations.mockResolvedValue(valeBase());
      administrativosService.assertSeleccionable.mockResolvedValue(undefined);
      repository.findByIdWithRelationsEn.mockResolvedValue(
        valeBase({ color: 'Rojo' }),
      );

      await service.modificar(
        'V-0001',
        { ...dtoMin, color: 'Rojo', almacen: 'Principal' },
        'miguel',
      );

      // `almacen` venía igual: no se toca ni se audita.
      expect(repository.aplicarModificacion).toHaveBeenCalledWith(
        'V-0001',
        expect.objectContaining({
          color: 'Rojo',
          modificadoPorId: 'ADM-02',
          modificadoEn: expect.any(Date) as Date,
        }),
        undefined,
        manager,
      );
      expect(repository.aplicarModificacion).toHaveBeenCalledWith(
        'V-0001',
        expect.not.objectContaining({ almacen: 'Principal' }),
        undefined,
        manager,
      );

      expect(auditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          usuario: 'miguel',
          accion: 'MODIFICAR_VALE',
          entidad: 'Vale',
          entidadId: 'V-0001',
          detalle: expect.objectContaining({
            modificadoPorId: 'ADM-02',
            campos: ['color'],
            antes: { color: 'Negro' },
            despues: { color: 'Rojo' },
          }) as unknown,
        }),
        manager,
      );
    });

    it('con administrativo firmante inactivo → 400 antes de escribir', async () => {
      repository.findByIdWithRelations.mockResolvedValue(valeBase());
      administrativosService.assertSeleccionable.mockRejectedValue(
        new BadRequestException(),
      );

      await expect(
        service.modificar('V-0001', { ...dtoMin, color: 'Rojo' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.aplicarModificacion).not.toHaveBeenCalled();
    });
  });

  // ── anulación ──────────────────────────────────────────────────────────────

  describe('anular', () => {
    it('con producción pagada → 400', async () => {
      repository.findByIdWithRelations.mockResolvedValue(
        valeBase({
          produccion: [registro({ estado: EstadoProduccion.PAGADO })],
        }),
      );

      await expect(
        service.anular('V-0001', 'se emitió mal', 'ADM-02', 'admin'),
      ).rejects.toThrow(/ya tiene producción pagada/);
      expect(repository.aplicarModificacion).not.toHaveBeenCalled();
    });

    it('un vale ya anulado → 400', async () => {
      repository.findByIdWithRelations.mockResolvedValue(
        valeBase({ estado: EstadoVale.ANULADO }),
      );

      await expect(
        service.anular('V-0001', 'otra vez', 'ADM-02', 'admin'),
      ).rejects.toThrow(/ya está anulado/);
    });

    it('feliz: marca anulado, guarda el motivo y deja el vale en la auditoría', async () => {
      repository.findByIdWithRelations.mockResolvedValue(
        valeBase({ produccion: [registro({ pares: 5 })] }),
      );
      administrativosService.assertSeleccionable.mockResolvedValue(undefined);
      repository.findByIdWithRelationsEn.mockResolvedValue(
        valeBase({ estado: EstadoVale.ANULADO }),
      );

      await service.anular(
        'V-0001',
        '  color equivocado  ',
        'ADM-02',
        'miguel',
      );

      expect(repository.aplicarModificacion).toHaveBeenCalledWith(
        'V-0001',
        expect.objectContaining({
          estado: EstadoVale.ANULADO,
          motivoAnulacion: 'color equivocado',
          anuladoPorId: 'ADM-02',
          anuladoEn: expect.any(Date) as Date,
        }),
        undefined,
        manager,
      );

      // El detalle conserva lo que el vale tenía: sin esto, un vale anulado no
      // se puede reconstruir para entender qué se perdió.
      expect(auditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'ANULAR_VALE',
          detalle: expect.objectContaining({
            motivo: 'color equivocado',
            anuladoPorId: 'ADM-02',
            tallas: { '40': 6, '41': 4 },
            produccion: [expect.objectContaining({ id: 'reg-1' })] as unknown,
          }) as unknown,
        }),
        manager,
      );
    });

    it('vale inexistente → 404', async () => {
      repository.findByIdWithRelations.mockResolvedValue(null);
      await expect(
        service.anular('V-9999', 'lo que sea', 'ADM-02', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── guarda compartida ──────────────────────────────────────────────────────

  describe('assertVigente', () => {
    it('deja pasar un vale activo', () => {
      expect(() => service.assertVigente(valeBase())).not.toThrow();
    });

    it('frena un vale anulado e informa el motivo', () => {
      expect(() =>
        service.assertVigente(
          valeBase({
            estado: EstadoVale.ANULADO,
            motivoAnulacion: 'duplicado del V-0007',
          }),
        ),
      ).toThrow(/duplicado del V-0007/);
    });
  });
  describe('assertStockSuficiente', () => {
    it('deja pasar cuando alcanza justo', async () => {
      repository.stockDisponible.mockResolvedValue(10);
      await expect(
        service.assertStockSuficiente('V-0001', 10),
      ).resolves.toBeUndefined();
    });

    it('rechaza cuando se piden mas pares de los que hay', async () => {
      repository.stockDisponible.mockResolvedValue(3);
      await expect(service.assertStockSuficiente('V-0001', 4)).rejects.toThrow(
        /solo tiene 3 pares disponibles y se intentan despachar 4/,
      );
    });

    // Sin stock el mensaje tiene que decirlo en plural igual: '0 pares'.
    it('rechaza cuando no hay nada fabricado', async () => {
      repository.stockDisponible.mockResolvedValue(0);
      await expect(service.assertStockSuficiente('V-0001', 1)).rejects.toThrow(
        /solo tiene 0 pares disponibles/,
      );
    });

    it('propaga el manager de la transaccion en curso', async () => {
      repository.stockDisponible.mockResolvedValue(5);
      const mgr = { marca: 'tx' };
      await service.assertStockSuficiente('V-0001', 1, mgr as never);
      expect(repository.stockDisponible).toHaveBeenCalledWith('V-0001', mgr);
    });
  });
});
