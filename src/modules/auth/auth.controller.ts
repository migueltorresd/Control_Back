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
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { UsuarioAutenticado } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto.username, dto.password, ip);
  }

  // Autenticado (cualquier rol): cada quien cambia su propia contraseña
  @Patch('password')
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
