import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './providers/users.service';
import { AuthModule } from 'src/auth/auth.module';
import { FindOneUserByEmailProvider } from './providers/find-one-user-by-email.provider';
import { CreateGoogleUserProvider } from './providers/create-google-user.provider';
import { FindOneByGoogleIdProvider } from './providers/find-one-by-google-id.provider';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    FindOneUserByEmailProvider,
    CreateGoogleUserProvider,
    FindOneByGoogleIdProvider,
  ],
  exports: [UsersService],
  imports: [forwardRef(() => AuthModule)],
})
export class UsersModule {}
