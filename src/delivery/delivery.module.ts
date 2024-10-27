import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './provider/delivery.service';

@Module({
  controllers: [DeliveryController],
  providers: [DeliveryService]
})
export class DeliveryModule {}
