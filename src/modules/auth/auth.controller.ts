import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { UsuarioAutenticado } from './jwt.strategy';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  // Límite estricto contra fuerza bruta: 5 intentos por minuto por IP
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión (Público)' })
  async login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto.username, dto.password, ip);
  }

  // Autenticado (cualquier rol): cada quien cambia su propia contraseña
  @Patch('password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña propia (Autenticado)' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request & { user: UsuarioAutenticado },
  ) {
    await this.authService.changePassword(
      req.user.userId,
      dto.passwordActual,
      dto.passwordNueva,
    );
    return { success: true };
  }
}
