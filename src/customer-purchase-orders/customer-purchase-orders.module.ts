import { Module } from '@nestjs/common';
import { CustomerPurchaseOrdersController } from './customer-purchase-orders.controller';
import { CustomerPurchaseOrdersService } from './provider/customer-purchase-orders.service';

@Module({
  controllers: [CustomerPurchaseOrdersController],
  providers: [CustomerPurchaseOrdersService]
})
export class CustomerPurchaseOrdersModule {}
