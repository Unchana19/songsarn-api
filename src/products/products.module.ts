import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './providers/products.service';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  imports: [UploadsModule],
})
export class ProductsModule {}
