import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('PasswordBreach');

const API = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = 2500;

/**
 * ¿La contraseña aparece en alguna filtración conocida? (OWASP ASVS 2.1.7)
 *
 * Una contraseña puede cumplir todas las reglas de largo y complejidad y aun
 * así ser inútil si está en los diccionarios que usan los atacantes. El largo
 * mínimo no protege de `Password2024!`.
 *
 * Usa k-anonymity: se calcula el SHA-1 de la contraseña y se envían SOLO los
 * primeros 5 caracteres del hash. El servicio devuelve todos los hashes que
 * empiezan igual (cientos) y la comparación final se hace acá. La contraseña
 * nunca sale de este proceso, ni tampoco su hash completo.
 *
 * Falla abierto a propósito: si el servicio no responde, se permite la
 * contraseña y se avisa por log. Bloquear el cambio de contraseña porque una
 * API externa está caída deja a la gente sin poder rotar credenciales —
 * justo lo contrario de lo que se busca.
 */
export async function estaFiltrada(password: string): Promise<boolean> {
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefijo = hash.slice(0, 5);
  const sufijo = hash.slice(5);

  try {
    const res = await fetch(`${API}${prefijo}`, {
      // Add-Padding hace que todas las respuestas midan parecido: sin esto, el
      // tamaño de la respuesta filtra información sobre el prefijo consultado.
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.warn(
        `El servicio de contraseñas filtradas respondió ${res.status}; se omite la verificación.`,
      );
      return false;
    }

    const cuerpo = await res.text();
    for (const linea of cuerpo.split('\n')) {
      const [suf, conteo] = linea.trim().split(':');
      // El padding viene con conteo 0: son entradas de relleno, no coincidencias.
      if (suf === sufijo && Number(conteo) > 0) return true;
    }
    return false;
  } catch (e) {
    logger.warn(
      `No se pudo verificar la contraseña contra filtraciones (${(e as Error).message}); se omite.`,
    );
    return false;
  }
}
