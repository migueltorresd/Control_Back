import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Base de datos.
  // Opción A (recomendada en Render/Neon): una sola cadena de conexión.
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }),
  // Opción B (Docker/local): variables sueltas. Solo se exigen si NO hay DATABASE_URL.
  DATABASE_HOST: Joi.string().when('DATABASE_URL', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  DATABASE_PORT: Joi.number().integer().positive().when('DATABASE_URL', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  DATABASE_USERNAME: Joi.string().when('DATABASE_URL', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  DATABASE_PASSWORD: Joi.string().when('DATABASE_URL', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  DATABASE_DATABASE: Joi.string().when('DATABASE_URL', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  // TLS hacia la BD. Opcional: si la DATABASE_URL trae sslmode=require se activa solo.
  DATABASE_SSL: Joi.boolean().default(false),

  // Servidor
  PORT: Joi.number().integer().positive().default(3001),

  // Autenticación JWT
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET debe tener al menos 32 caracteres',
    'any.required': 'JWT_SECRET es requerido',
  }),
  JWT_EXPIRES_IN: Joi.string().default('8h'),

  // CORS — orígenes permitidos del frontend (separados por comas)
  CORS_ORIGIN: Joi.string().required().messages({
    'any.required':
      'CORS_ORIGIN es requerido (URL del frontend, p. ej. http://localhost:3000)',
  }),

  // Entorno
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Zona horaria del negocio (para fechar pagos/ventas en hora local)
  BUSINESS_TZ: Joi.string().default('America/Bogota'),

  // Directorio de subidas
  UPLOADS_DIR: Joi.string().default('./uploads'),

  // Swagger
  SWAGGER_ENABLED: Joi.boolean().default(false),
}).options({ allowUnknown: true }); // permite variables de SO sin romper el arranque
