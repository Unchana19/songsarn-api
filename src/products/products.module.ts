import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './providers/products.service';
import { UploadsModule } from 'src/uploads/uploads.module';
import { CartsModule } from 'src/carts/carts.module';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  imports: [UploadsModule, CartsModule],
})
export class ProductsModule {}
