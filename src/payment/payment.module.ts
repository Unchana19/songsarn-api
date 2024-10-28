import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './providers/payment.service';
import { CustomerPurchaseOrdersModule } from 'src/customer-purchase-orders/customer-purchase-orders.module';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService],
  imports: [CustomerPurchaseOrdersModule],
})
export class PaymentModule {}
