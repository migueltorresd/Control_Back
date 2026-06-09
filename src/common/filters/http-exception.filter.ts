import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse: any = exception.getResponse();
      
      if (typeof exceptionResponse === 'object') {
        message = exceptionResponse.message || message;
        errors = exceptionResponse.error || null;
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      // Manejar excepciones genéricas del sistema que no sean HTTP (e.g. errores de negocio arrojados como Error)
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
    }

    // Para evitar 500s genéricos en errores de negocio conocidos,
    // mostramos el mensaje original del Error.
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: Array.isArray(message) ? message[0] : message, // Tomar el primer mensaje si es un array de validación
      details: Array.isArray(message) ? message : null, // Mostrar detalles completos de validación si existen
      error: errors,
    });
  }
}
