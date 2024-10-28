import { Controller, Get } from '@nestjs/common';
import { TransactionsService } from './providers/transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  public async getAllTransactions() {
    return this.transactionsService.getAllTransactions();
  }
}
