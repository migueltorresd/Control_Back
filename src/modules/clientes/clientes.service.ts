import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

/**
 * Normaliza un nombre para compararlo: sin tildes, sin puntuación, sin
 * espacios de más y en mayúsculas. Espeja la expresión SQL del índice único
 * `UQ_clientes_nombre_normalizado`.
 *
 * Se valida aquí ADEMÁS del índice para poder dar un mensaje que se entienda
 * («ya existe un cliente llamado X») en vez del error crudo de Postgres.
 */
/**
 * La misma normalización, pero en SQL. Tiene que coincidir con la expresión
 * del índice `UQ_clientes_nombre_normalizado`, o Postgres no lo usaría y las
 * dos validaciones podrían diferir.
 */
export const CLAVE_SQL = (col: string) => `upper(
  regexp_replace(
    translate(btrim(${col}), 'áéíóúÁÉÍÓÚñÑüÜ.,', 'aeiouAEIOUnNuU'),
    '[[:space:]]+', ' ', 'g'
  )
)`;

export function normalizarNombre(nombre: string): string {
  return (
    nombre
      .trim()
      .normalize('NFD')
      // Marcas diacríticas: así «á» (a + tilde) queda en «a».
      .replace(/[̀-ͯ]/g, '')
      .replace(/[.,]/g, '')
      .replace(/\s+/g, ' ')
      .toUpperCase()
  );
}

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly repo: Repository<Cliente>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  findAll(): Promise<Cliente[]> {
    return this.repo.find({ order: { nombre: 'ASC' } });
  }

  async findOne(id: string): Promise<Cliente> {
    const cliente = await this.repo.findOne({ where: { id } });
    if (!cliente) {
      throw new NotFoundException(`No existe el cliente ${id}`);
    }
    return cliente;
  }

  /**
   * El que se usa al emitir una remisión: tiene que existir y estar activo.
   * Un cliente dado de baja no puede recibir mercancía nueva, pero su
   * histórico y su cartera siguen intactos.
   */
  async assertSeleccionable(
    id: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Cliente> {
    const cliente = await manager.findOne(Cliente, { where: { id } });
    if (!cliente) {
      throw new BadRequestException(`No existe el cliente ${id}`);
    }
    if (!cliente.activo) {
      throw new BadRequestException(
        `${cliente.nombre} está inactivo. Actívalo en Configuración para remitirle mercancía.`,
      );
    }
    return cliente;
  }

  async create(dto: CreateClienteDto): Promise<Cliente> {
    await this.assertNombreLibre(dto.nombre);
    await this.assertDocumentoLibre(dto.documento);

    const id = await this.nextId();
    const cliente = this.repo.create({
      id,
      nombre: dto.nombre.trim(),
      documento: dto.documento?.trim() || null,
      direccion: dto.direccion?.trim() || null,
      telefono: dto.telefono?.trim() || null,
      correo: dto.correo?.trim() || null,
    });
    return this.repo.save(cliente);
  }

  async update(id: string, dto: UpdateClienteDto): Promise<Cliente> {
    const cliente = await this.findOne(id);

    if (dto.nombre !== undefined) {
      await this.assertNombreLibre(dto.nombre, id);
      cliente.nombre = dto.nombre.trim();
    }
    if (dto.documento !== undefined) {
      await this.assertDocumentoLibre(dto.documento, id);
      cliente.documento = dto.documento?.trim() || null;
    }
    if (dto.direccion !== undefined) {
      cliente.direccion = dto.direccion?.trim() || null;
    }
    if (dto.telefono !== undefined) {
      cliente.telefono = dto.telefono?.trim() || null;
    }
    if (dto.correo !== undefined) {
      cliente.correo = dto.correo?.trim() || null;
    }
    if (dto.activo !== undefined) {
      cliente.activo = dto.activo;
    }

    return this.repo.save(cliente);
  }

  /**
   * Choca con el índice único antes de llegar a Postgres, para poder decir
   * CUÁL es el cliente que ya existe. `excluirId` deja editar un cliente sin
   * que choque consigo mismo.
   */
  private async assertNombreLibre(
    nombre: string,
    excluirId?: string,
  ): Promise<void> {
    const clave = normalizarNombre(nombre);
    if (!clave) {
      throw new BadRequestException('El nombre del cliente no puede ir vacío.');
    }

    // La comparación va en SQL con la misma expresión del índice único, no
    // trayendo la tabla a memoria: así se aprovecha el índice y da igual que
    // el catálogo crezca.
    const choca = await this.repo
      .createQueryBuilder('c')
      .where(`${CLAVE_SQL('c.nombre')} = :clave`, { clave })
      .andWhere(excluirId ? 'c.id <> :excluirId' : '1=1', { excluirId })
      .getOne();

    if (choca) {
      throw new ConflictException(
        `Ya existe un cliente llamado «${choca.nombre}» (${choca.id}). ` +
          'Se comparan los nombres ignorando tildes, puntuación y mayúsculas.',
      );
    }
  }

  private async assertDocumentoLibre(
    documento: string | undefined,
    excluirId?: string,
  ): Promise<void> {
    const doc = documento?.trim();
    if (!doc) return;

    const choca = await this.repo
      .createQueryBuilder('c')
      .where('btrim(c.documento) = :doc', { doc })
      .getOne();

    if (choca && choca.id !== excluirId) {
      throw new ConflictException(
        `El documento ${doc} ya está cargado en «${choca.nombre}» (${choca.id}).`,
      );
    }
  }

  private async nextId(): Promise<string> {
    const filas = await this.dataSource.query<{ n: string }[]>(
      `SELECT nextval('clientes_seq') AS n`,
    );
    return 'CLI-' + String(Number(filas[0].n)).padStart(4, '0');
  }
}
