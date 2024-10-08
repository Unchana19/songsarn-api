import {
  forwardRef,
  Inject,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import jwtConfig from 'src/auth/configs/jwt.config';
import { GoogleTokenDto } from '../dtos/google-token.dto';
import { UsersService } from 'src/users/providers/users.service';
import { GenerateTokensProvider } from 'src/auth/providers/generate-tokens.provider';

@Injectable()
export class GoogleAuthenticationService implements OnModuleInit {
  private oAuthClient: OAuth2Client;

  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,

    private readonly generateTokensProvider: GenerateTokensProvider,
  ) {}

  onModuleInit() {
    const clientId = this.jwtConfiguration.googleClientId;
    const clientSecret = this.jwtConfiguration.googleClientSecret;

    this.oAuthClient = new OAuth2Client(clientId, clientSecret);
  }

  public async authentication(googleTokenDto: GoogleTokenDto) {
    try {
      const loginTicket = await this.oAuthClient.verifyIdToken({
        idToken: googleTokenDto.token,
      });

      const {
        email,
        sub: googleId,
        given_name: name,
        picture: img,
      } = loginTicket.getPayload();

      const user = await this.usersService.findOneByGoogleId(googleId);

      if (user) {
        const { accessToken, refreshToken } =
          await this.generateTokensProvider.generateTokens(user);
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          img: user.img,
          accessToken,
          refreshToken,
        };
      }

      const newUser = await this.usersService.createGoogleUser({
        email,
        name,
        googleId,
        img,
      });

      const { accessToken, refreshToken } =
        await this.generateTokensProvider.generateTokens(newUser);

      return {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        img: newUser.img,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException(error);
    }
  }
}
