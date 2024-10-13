import { Module } from '@nestjs/common';
import { ComponentsController } from './components.controller';
import { ComponentsService } from './providers/components.service';

@Module({
  controllers: [ComponentsController],
  providers: [ComponentsService]
})
export class ComponentsModule {}
