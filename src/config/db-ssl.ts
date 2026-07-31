import type { TlsOptions } from 'node:tls';

/** Cómo se conecta node-postgres: sin TLS, o con TLS y estas opciones. */
export type DbSslConfig = false | true | TlsOptions;

/**
 * Configuración TLS de la conexión a la base, en un solo lugar.
 *
 * Vivía duplicada en cinco archivos (app.module, data-source, seed.module y los
 * scripts de CLI), todos con `rejectUnauthorized: false`. Eso desactiva la
 * validación del certificado del servidor: cualquiera que se meta en el medio
 * de la conexión puede presentar un certificado propio, leer las credenciales
 * y todo el tráfico. Es un MITM de manual.
 *
 * Ahora el valor por defecto VALIDA el certificado. Neon, Render y cualquier
 * Postgres gestionado usan certificados de una CA pública, así que funcionan
 * sin configuración extra.
 *
 * Escotilla de escape para bases con certificado autofirmado (Docker local,
 * algún on-premise): `DATABASE_SSL_INSECURE=true`. Nunca en producción — por
 * eso se avisa por consola cada vez que se usa.
 */
export function resolverDbSsl(env: {
  DATABASE_URL?: string;
  DATABASE_SSL?: boolean | string;
  DATABASE_SSL_INSECURE?: boolean | string;
}): DbSslConfig {
  const activo =
    esVerdadero(env.DATABASE_SSL) || !!env.DATABASE_URL?.includes('sslmode=');

  if (!activo) return false;

  if (esVerdadero(env.DATABASE_SSL_INSECURE)) {
    console.warn(
      '[db-ssl] DATABASE_SSL_INSECURE=true: no se valida el certificado de la ' +
        'base. La conexión queda expuesta a intercepción. Solo para desarrollo.',
    );
    return { rejectUnauthorized: false };
  }

  return true;
}

function esVerdadero(valor: boolean | string | undefined): boolean {
  return valor === true || valor === 'true';
}
