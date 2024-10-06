import {
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../configs/jwt.config';
import { GenerateTokensProvider } from './generate-tokens.provider';
import { UsersService } from 'src/users/providers/users.service';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { GetUserParamDto } from 'src/users/dtos/get-user-param.dto';

@Injectable()
export class RefreshTokensProvider {
  constructor(
    private readonly jwtService: JwtService,
    private readonly generateTokenProvider: GenerateTokensProvider,

    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  public async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    try {
      const { sub } = await this.jwtService.verifyAsync<
        Pick<ActiveUserData, 'sub'>
      >(refreshTokenDto.refreshToken, {
        secret: this.jwtConfiguration.secret,
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
      });

      const getUserParamDto = { id: sub } as GetUserParamDto;

      const user = await this.usersService.findOneById(getUserParamDto);

      return await this.generateTokenProvider.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException(error);
    }
  }
}
