import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './providers/users.service';
import { AuthModule } from 'src/auth/auth.module';
import { FindOneUserByEmailProvider } from './providers/find-one-user-by-email.provider';

@Module({
  controllers: [UsersController],
  providers: [UsersService, FindOneUserByEmailProvider],
  exports: [UsersService],
  imports: [forwardRef(() => AuthModule)],
})
export class UsersModule {}
