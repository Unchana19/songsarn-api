import { Controller } from '@nestjs/common';
import { HistoryService } from './providers/history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}
}
