export enum Rol {
  /** Dueño técnico del sistema: administra las cuentas de los demás. */
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  OPERARIO = 'OPERARIO',
}

/**
 * Los roles son una jerarquía, no una lista de etiquetas sueltas.
 *
 * Sin esto, `@Roles(Rol.ADMIN)` rechazaría a un SUPER_ADMIN por no coincidir
 * exactamente: el rol más alto del sistema quedaría sin acceso a nada. Y la
 * alternativa —enumerar `@Roles(ADMIN, SUPER_ADMIN)` en cada controlador— se
 * rompe sola en cuanto alguien agrega un endpoint y se olvida de uno.
 */
const RANGO: Record<Rol, number> = {
  [Rol.SUPER_ADMIN]: 3,
  [Rol.ADMIN]: 2,
  [Rol.OPERARIO]: 1,
};

/** ¿`rol` llega al nivel exigido por `minimo` (o lo supera)? */
export function alcanzaRol(rol: Rol, minimo: Rol): boolean {
  return (RANGO[rol] ?? 0) >= (RANGO[minimo] ?? 0);
}

/** ¿`rol` está estrictamente por encima de `otro`? Para gestionar cuentas ajenas. */
export function superaA(rol: Rol, otro: Rol): boolean {
  return (RANGO[rol] ?? 0) > (RANGO[otro] ?? 0);
}
