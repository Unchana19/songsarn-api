import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import environmentValidation from './configs/environment.validation';
import databaseConfig from './database/configs/database.config';
import { APP_GUARD } from '@nestjs/core';
import { AccessTokenGuard } from './auth/guards/access-token.guard';
import { AuthenticationGuard } from './auth/guards/authentication.guard';
import jwtConfig from './auth/configs/jwt.config';
import { JwtModule } from '@nestjs/jwt';
import { MaterialsModule } from './materials/materials.module';
import { RequisitionsModule } from './requisitions/requisitions.module';
import { MaterialPurchaseOrdersModule } from './material-purchase-orders/material-purchase-orders.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ComponentsModule } from './components/components.module';
import { CategoriesModule } from './categories/categories.module';
import { UploadsModule } from './uploads/uploads.module';
import { ProductsModule } from './products/products.module';
import { CustomerPurchaseOrdersModule } from './customer-purchase-orders/customer-purchase-orders.module';
import { CartsModule } from './carts/carts.module';
import { DeliveryModule } from './delivery/delivery.module';
import { HistoryModule } from './history/history.module';
import { PaymentModule } from './payment/payment.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LikesModule } from './likes/likes.module';
import appConfig from './configs/app.config';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forFeature(jwtConfig),
    UsersModule,
    AuthModule,
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
      load: [appConfig, databaseConfig, jwtConfig],
      validationSchema: environmentValidation,
    }),
    MaterialsModule,
    RequisitionsModule,
    MaterialPurchaseOrdersModule,
    TransactionsModule,
    ComponentsModule,
    CategoriesModule,
    UploadsModule,
    ProductsModule,
    CustomerPurchaseOrdersModule,
    CartsModule,
    DeliveryModule,
    HistoryModule,
    PaymentModule,
    DashboardModule,
    LikesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    AccessTokenGuard,
  ],
})
export class AppModule {}
