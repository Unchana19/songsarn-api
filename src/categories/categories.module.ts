import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './providers/categories.service';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, UploadsModule],
  imports: [UploadsModule],
})
export class CategoriesModule {}
