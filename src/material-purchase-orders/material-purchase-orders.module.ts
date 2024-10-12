import { Module } from '@nestjs/common';
import { MaterialPurchaseOrdersController } from './material-purchase-orders.controller';
import { MaterialPurchaseOrdersService } from './providers/material-purchase-orders.service';
import { RequisitionsModule } from 'src/requisitions/requisitions.module';
import { TransactionsModule } from 'src/transactions/transactions.module';

@Module({
  controllers: [MaterialPurchaseOrdersController],
  providers: [MaterialPurchaseOrdersService],
  imports: [RequisitionsModule, TransactionsModule],
})
export class MaterialPurchaseOrdersModule {}
