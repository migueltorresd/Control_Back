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

  // Entorno
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
}).options({ allowUnknown: true }); // permite variables de SO sin romper el arranque
