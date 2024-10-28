import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './providers/dashboard.service';
import { DashboardData } from './interfaces/dashboard-data.interface';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { AuthType } from 'src/auth/enums/auth-type.enum';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Auth(AuthType.None)
  async getDashboard(
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' | 'year',
    @Query('date') dateString: string,
  ): Promise<DashboardData> {
    let date: Date;
    if (dateString) {
      date = new Date(dateString);
    } else {
      date = new Date();
    }

    if (isNaN(date.getTime())) {
      date = new Date();
    }

    return this.dashboardService.getDashboardDataByTimeframe(
      timeframe || 'week',
      date,
    );
  }
}
