import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Base de datos
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().integer().positive().required(),
  DATABASE_USERNAME: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_DATABASE: Joi.string().required(),

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
