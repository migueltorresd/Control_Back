import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { CarteraService } from './cartera.service';
import { AbonosRepository } from './abonos.repository';
import { AdministrativosService } from '../administrativos/administrativos.service';
import { MetodoAbono } from '../../common/enums/metodo-abono.enum';

describe('CarteraService', () => {
  let service: CarteraService;

  const manager = { insert: jest.fn(), query: jest.fn() };
  const dataSource = {
    manager,
    transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
    query: jest.fn(),
  };
  const repository = { nextId: jest.fn() };
  const administrativosService = { assertSeleccionable: jest.fn() };

  /** Fila cruda tal como la devuelve la consulta de `cuentaDe`. */
  const fila = (numero: string, fecha: string, total: number, abonado = 0) => ({
    numero,
    fecha,
    cliente: 'Omar Bermúdez',
    total: String(total),
    abonado: String(abonado),
  });

  /**
   * Tres remisiones de un mismo cliente, de la más antigua a la más nueva.
   * Deuda total: 900.000.
   */
  const tresRemisiones = () => [
    fila('REM-0005', '2026-07-15', 360000),
    fila('REM-0006', '2026-08-10', 300000),
    fila('REM-0007', '2026-09-05', 240000),
  ];

  const abonar = (monto: number) =>
    service.abonarACliente(
      'OMAR BERMUDEZ',
      monto,
      MetodoAbono.TRANSFERENCIA,
      'ADM-01',
    );

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CarteraService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: AbonosRepository, useValue: repository },
        { provide: AdministrativosService, useValue: administrativosService },
      ],
    }).compile();
    service = module.get(CarteraService);

    dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
      cb(manager),
    );
    let n = 0;
    repository.nextId.mockImplementation(() => Promise.resolve(`AB-000${++n}`));
  });

  describe('cuentaDe', () => {
    it('suma el total, lo abonado y el saldo del cliente', async () => {
      manager.query.mockResolvedValue([
        fila('REM-0005', '2026-07-15', 360000, 60000),
        fila('REM-0006', '2026-08-10', 300000),
      ]);

      const cuenta = await service.cuentaDe('OMAR BERMUDEZ');

      expect(cuenta.total).toBe(660000);
      expect(cuenta.abonado).toBe(60000);
      expect(cuenta.saldo).toBe(600000);
      expect(cuenta.remisiones).toBe(2);
    });

    it('devuelve la fecha como string YYYY-MM-DD, no como Date', async () => {
      manager.query.mockResolvedValue(tresRemisiones());

      const cuenta = await service.cuentaDe('OMAR BERMUDEZ');

      // El resto de la API entrega las fechas así; la cartera no puede ser
      // la excepción solo porque use SQL crudo.
      cuenta.detalle.forEach((d) =>
        expect(d.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/),
      );
    });

    it('muestra el nombre normalizado y conserva la grafía en el detalle', async () => {
      manager.query.mockResolvedValue(tresRemisiones());

      const cuenta = await service.cuentaDe('OMAR BERMUDEZ');

      expect(cuenta.cliente).toBe('OMAR BERMUDEZ');
      expect(cuenta.detalle[0].cliente).toBe('Omar Bermúdez');
    });

    it('apunta como más antigua la primera remisión con saldo', async () => {
      manager.query.mockResolvedValue([
        // La más vieja ya está saldada: no es la que toca cobrar.
        fila('REM-0005', '2026-07-15', 360000, 360000),
        fila('REM-0006', '2026-08-10', 300000),
      ]);

      const cuenta = await service.cuentaDe('OMAR BERMUDEZ');

      expect(cuenta.masAntigua).toBe('2026-08-10');
    });

    it('un cliente sin remisiones devuelve una cuenta vacía, no un error', async () => {
      manager.query.mockResolvedValue([]);

      const cuenta = await service.cuentaDe('NO EXISTE');

      expect(cuenta.saldo).toBe(0);
      expect(cuenta.remisiones).toBe(0);
      expect(cuenta.masAntigua).toBeNull();
    });
  });

  describe('clientesConDeuda', () => {
    it('ordena de mayor a menor deuda y deja fuera a los que ya pagaron', async () => {
      dataSource.query.mockResolvedValue([
        { clave: 'CHICO' },
        { clave: 'GRANDE' },
        { clave: 'SALDADO' },
      ]);
      const porClave: Record<string, ReturnType<typeof tresRemisiones>> = {
        CHICO: [fila('REM-0001', '2026-07-01', 100000)],
        GRANDE: [fila('REM-0002', '2026-07-02', 900000)],
        SALDADO: [fila('REM-0003', '2026-07-03', 500000, 500000)],
      };
      manager.query.mockImplementation((_sql: string, params: unknown[]) =>
        Promise.resolve(porClave[params[0] as string]),
      );

      const cuentas = await service.clientesConDeuda();

      expect(cuentas.map((c) => c.clave)).toEqual(['GRANDE', 'CHICO']);
    });
  });

  describe('abonarACliente', () => {
    it('salda la más antigua antes de tocar la siguiente', async () => {
      manager.query.mockResolvedValue(tresRemisiones());

      // 510.000 = los 360.000 de la primera + 150.000 de la segunda.
      const { aplicado } = await abonar(510000);

      expect(aplicado).toEqual([
        {
          remision: 'REM-0005',
          monto: 360000,
          abonoId: 'AB-0001',
          saldoAnterior: 360000,
          saldoNuevo: 0,
        },
        {
          remision: 'REM-0006',
          monto: 150000,
          abonoId: 'AB-0002',
          saldoAnterior: 300000,
          saldoNuevo: 150000,
        },
      ]);
    });

    it('no toca las remisiones que el abono no alcanza a cubrir', async () => {
      manager.query.mockResolvedValue(tresRemisiones());

      const { aplicado } = await abonar(510000);

      expect(aplicado).toHaveLength(2);
      expect(aplicado.map((a) => a.remision)).not.toContain('REM-0007');
      expect(manager.insert).toHaveBeenCalledTimes(2);
    });

    it('guarda una fila de abono por cada remisión alcanzada', async () => {
      manager.query.mockResolvedValue(tresRemisiones());

      const montos: number[] = [];
      manager.insert.mockImplementation(
        (_entidad: unknown, valores: { monto: number }) => {
          montos.push(valores.monto);
          return Promise.resolve();
        },
      );

      await abonar(900000);

      // Nada de una tabla aparte: cada porción es un abono normal contra su
      // remisión, para que el saldo de cada documento siga cuadrando solo.
      expect(manager.insert).toHaveBeenCalledTimes(3);
      expect(montos).toEqual([360000, 300000, 240000]);
    });

    it('se salta las remisiones que ya estaban saldadas', async () => {
      manager.query.mockResolvedValue([
        fila('REM-0005', '2026-07-15', 360000, 360000),
        fila('REM-0006', '2026-08-10', 300000),
      ]);

      const { aplicado } = await abonar(100000);

      expect(aplicado).toHaveLength(1);
      expect(aplicado[0].remision).toBe('REM-0006');
    });

    it('rechaza un abono mayor a la deuda total', async () => {
      manager.query.mockResolvedValue(tresRemisiones());

      // Recibir de más no es un abono: sobra plata sin documento al cual
      // imputarla.
      await expect(abonar(900001)).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('rechaza un abono de cero o negativo', async () => {
      await expect(abonar(0)).rejects.toBeInstanceOf(BadRequestException);
      await expect(abonar(-1000)).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('rechaza abonar a un cliente que no debe nada', async () => {
      manager.query.mockResolvedValue([]);

      await expect(abonar(50000)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('valida el administrativo antes de mover plata', async () => {
      administrativosService.assertSeleccionable.mockRejectedValue(
        new BadRequestException('inactivo'),
      );

      await expect(abonar(50000)).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('relee la cuenta dentro de la transacción', async () => {
      manager.query.mockResolvedValue(tresRemisiones());

      await abonar(100000);

      // El saldo se calcula con el manager de la transacción, no con el de
      // fuera: dos personas cobrando a la vez no pueden repartir la misma
      // plata dos veces.
      expect(manager.query).toHaveBeenCalled();
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('reparte sin dejar centavos colgados', async () => {
      manager.query.mockResolvedValue([
        fila('REM-0005', '2026-07-15', 33333.33),
        fila('REM-0006', '2026-08-10', 33333.33),
        fila('REM-0007', '2026-09-05', 33333.34),
      ]);

      const { aplicado } = await abonar(100000);

      const repartido = aplicado.reduce((s, a) => s + a.monto, 0);
      expect(Number(repartido.toFixed(2))).toBe(100000);
      expect(aplicado.every((a) => a.saldoNuevo === 0)).toBe(true);
    });
  });
});
