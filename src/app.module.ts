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
      load: [databaseConfig, jwtConfig],
      validationSchema: environmentValidation,
    }),
    MaterialsModule,
    RequisitionsModule,
    MaterialPurchaseOrdersModule,
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
