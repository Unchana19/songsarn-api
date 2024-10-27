import { Module } from '@nestjs/common';
import { HistoryController } from './history.controller';
import { HistoryService } from './providers/history.service';

@Module({
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
