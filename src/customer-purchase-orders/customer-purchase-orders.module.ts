import { Module } from '@nestjs/common';
import { CustomerPurchaseOrdersController } from './customer-purchase-orders.controller';
import { CustomerPurchaseOrdersService } from './provider/customer-purchase-orders.service';
import { HistoryModule } from 'src/history/history.module';

@Module({
  controllers: [CustomerPurchaseOrdersController],
  providers: [CustomerPurchaseOrdersService],
  imports: [HistoryModule],
})
export class CustomerPurchaseOrdersModule {}
