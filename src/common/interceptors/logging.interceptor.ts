import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { UsuarioAutenticado } from '../../modules/auth/jwt.strategy';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<
      Request & { user?: UsuarioAutenticado }
    >();
    const response = httpContext.getResponse<Response>();

    const { method, originalUrl } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        const user = request.user;
        const username = user?.username ? user.username : 'anonymous';

        this.logMessage(method, originalUrl, statusCode, duration, username);
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - startTime;

        let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        if (error && typeof error === 'object') {
          const errRecord = error as Record<string, unknown>;
          if (typeof errRecord.status === 'number') {
            statusCode = errRecord.status;
          } else if (typeof errRecord.statusCode === 'number') {
            statusCode = errRecord.statusCode;
          }
        }

        const user = request.user;
        const username = user?.username ? user.username : 'anonymous';
        const errorMsg = error instanceof Error ? error.message : String(error);

        this.logMessage(
          method,
          originalUrl,
          statusCode,
          duration,
          username,
          errorMsg,
        );
        return throwError(() => error);
      }),
    );
  }

  private logMessage(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    username: string,
    errorMessage?: string,
  ) {
    const message = `${method} ${url} ${statusCode} - ${duration}ms - User: ${username}${
      errorMessage ? ` - Error: ${errorMessage}` : ''
    }`;

    if (statusCode >= 500) {
      this.logger.error(message);
    } else if (statusCode >= 400) {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }
}
