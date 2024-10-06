import {
  forwardRef,
  Inject,
  Injectable,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/providers/users.service';
import { HashingProvider } from './hashing.provider';
import { GenerateTokensProvider } from './generate-tokens.provider';
import { SignInDto } from '../dtos/sign-in.dto';

@Injectable()
export class SignInProvider {
  constructor(
    private readonly hashingProvider: HashingProvider,
    private readonly generateTokenProvider: GenerateTokensProvider,

    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  public async signIn(signInDto: SignInDto) {
    const user = await this.usersService.findOneByEmail(signInDto.email);

    let isEqual: boolean = false;

    try {
      isEqual = await this.hashingProvider.comparePassword(
        signInDto.password,
        user.password,
      );
    } catch (error) {
      throw new RequestTimeoutException(error, {
        description: 'Could not compare passwords',
      });
    }

    if (!isEqual) {
      throw new UnauthorizedException('Incorrect Password');
    }

    const { accessToken, refreshToken } =
      await this.generateTokenProvider.generateTokens(user);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      img: user.img,
      accessToken,
      refreshToken,
    };
  }
}
