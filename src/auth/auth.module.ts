import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { HashingProvider } from './providers/hashing.provider';
import { BcryptProvider } from './providers/bcrypt.provider';
import { UsersModule } from 'src/users/users.module';
import { AuthService } from './providers/auth.service';
import { SignInProvider } from './providers/sign-in.provider';
import { GenerateTokensProvider } from './providers/generate-tokens.provider';
import { RefreshTokensProvider } from './providers/refresh-tokens.provider';
import { ConfigModule } from '@nestjs/config';
import jwtConfig from './configs/jwt.config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: HashingProvider,
      useClass: BcryptProvider,
    },
    AuthService,
    SignInProvider,
    GenerateTokensProvider,
    RefreshTokensProvider,
  ],
  imports: [
    forwardRef(() => UsersModule),
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
  ],
  exports: [HashingProvider],
})
export class AuthModule {}
