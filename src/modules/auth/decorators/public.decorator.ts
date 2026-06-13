import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca un endpoint como accesible sin token (excepción al fail-closed global). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
