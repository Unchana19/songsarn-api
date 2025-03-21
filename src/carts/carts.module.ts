import { Module } from '@nestjs/common';
import { CartsController } from './carts.controller';
import { CartsService } from './providers/carts.service';

@Module({
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}
