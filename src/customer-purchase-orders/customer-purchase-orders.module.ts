import { Module } from '@nestjs/common';
import { CustomerPurchaseOrdersController } from './customer-purchase-orders.controller';
import { CustomerPurchaseOrdersService } from './provider/customer-purchase-orders.service';
import { HistoryModule } from 'src/history/history.module';
import { CheckAndCreateMaterialRequisitionsProvider } from './provider/check-create-material-requisition.provider';

@Module({
  controllers: [CustomerPurchaseOrdersController],
  providers: [
    CustomerPurchaseOrdersService,
    CheckAndCreateMaterialRequisitionsProvider,
  ],
  imports: [HistoryModule],
  exports: [CustomerPurchaseOrdersService],
})
export class CustomerPurchaseOrdersModule {}
