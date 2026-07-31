import { resolverDbSsl } from './db-ssl';

describe('resolverDbSsl', () => {
  it('sin TLS pedido devuelve false', () => {
    expect(resolverDbSsl({})).toBe(false);
    expect(resolverDbSsl({ DATABASE_URL: 'postgres://x/y' })).toBe(false);
  });

  it('con sslmode en la URL valida el certificado', () => {
    expect(
      resolverDbSsl({ DATABASE_URL: 'postgres://x/y?sslmode=require' }),
    ).toBe(true);
  });

  it('con DATABASE_SSL=true valida el certificado', () => {
    expect(resolverDbSsl({ DATABASE_SSL: true })).toBe(true);
    expect(resolverDbSsl({ DATABASE_SSL: 'true' })).toBe(true);
  });

  // El bug que motivó este archivo: rejectUnauthorized:false estaba hardcodeado
  // en cinco lugares, dejando la conexión abierta a intercepción.
  it('NUNCA desactiva la validación por defecto', () => {
    const casos = [
      { DATABASE_URL: 'postgres://x/y?sslmode=require' },
      { DATABASE_SSL: true },
      { DATABASE_SSL: 'true', DATABASE_SSL_INSECURE: 'false' },
    ];
    for (const caso of casos) {
      expect(resolverDbSsl(caso)).toBe(true);
    }
  });

  it('solo desactiva la validación con DATABASE_SSL_INSECURE=true explícito', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      resolverDbSsl({ DATABASE_SSL: true, DATABASE_SSL_INSECURE: 'true' }),
    ).toEqual({ rejectUnauthorized: false });
  });

  it('avisa por consola cuando se desactiva la validación', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    resolverDbSsl({ DATABASE_SSL: true, DATABASE_SSL_INSECURE: 'true' });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no se valida el certificado'),
    );
  });
});
