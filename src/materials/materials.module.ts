import { Module } from '@nestjs/common';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './providers/materials.service';

@Module({
  controllers: [MaterialsController],
  providers: [MaterialsService],
})
export class MaterialsModule {}
