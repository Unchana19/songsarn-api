import { Module } from '@nestjs/common';
import { ComponentsController } from './components.controller';
import { ComponentsService } from './providers/components.service';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  controllers: [ComponentsController],
  providers: [ComponentsService],
  imports: [UploadsModule],
})
export class ComponentsModule {}
