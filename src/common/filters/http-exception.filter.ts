import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let errors: unknown = null;

    if (exception instanceof HttpException) {
      // Excepciones HTTP controladas: se responde su status y mensaje original
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as {
          message?: string | string[];
          error?: unknown;
        };
        message = body.message ?? message;
        errors = body.error ?? null;
      } else {
        message = exceptionResponse;
      }
    } else {
      // Cualquier otro error es inesperado: 500 genérico sin detalles internos.
      // El detalle completo queda solo en el log del servidor.
      const detail =
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception);
      this.logger.error(
        `Error no controlado en ${request.method} ${request.url}: ${detail}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: Array.isArray(message) ? message[0] : message, // Primer mensaje si es array de validación
      details: Array.isArray(message) ? message : null, // Detalle completo de validación si existe
      error: errors,
    });
  }
}
