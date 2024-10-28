import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './providers/dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
