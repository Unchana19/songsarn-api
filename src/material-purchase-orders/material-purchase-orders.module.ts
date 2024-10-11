import { Module } from '@nestjs/common';
import { MaterialPurchaseOrdersController } from './material-purchase-orders.controller';
import { MaterialPurchaseOrdersService } from './providers/material-purchase-orders.service';

@Module({
  controllers: [MaterialPurchaseOrdersController],
  providers: [MaterialPurchaseOrdersService]
})
export class MaterialPurchaseOrdersModule {}
