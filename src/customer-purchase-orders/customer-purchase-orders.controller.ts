import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CustomerPurchaseOrdersService } from './provider/customer-purchase-orders.service';
import { CreateCPODto } from './dtos/create-cpo.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Controller('customer-purchase-orders')
export class CustomerPurchaseOrdersController {
  constructor(
    private readonly customerPurchaseOrdersService: CustomerPurchaseOrdersService,
  ) {}

  @Post()
  public async createCPO(@Body() createCPODto: CreateCPODto) {
    return this.customerPurchaseOrdersService.create(createCPODto);
  }

  @Get()
  public async getAllCPOByUserId(@Query('id') id: string) {
    return this.customerPurchaseOrdersService.getAllCPOByUserId(id);
  }

  @Get('detail/:id')
  public async getCPOById(@Param('id') id: string) {
    return this.customerPurchaseOrdersService.getCPOById(id);
  }

  @Get('manager')
  public async managerGetAllCPO() {
    return this.customerPurchaseOrdersService.managerGetAllCPO();
  }

  @Get('manager/detail/:id')
  public async managerGetCPOById(@Param('id') id: string) {
    return this.customerPurchaseOrdersService.managerGetCPOById(id);
  }

  @Patch('manager/process/:id')
  public async processCPOById(@Param('id') id: string) {
    return this.customerPurchaseOrdersService.processCPOById(id);
  }

  @Patch('manager/finished-process/:id')
  public async finishedProcessCPOById(@Param('id') id: string) {
    return this.customerPurchaseOrdersService.finishedProcessCPOById(id);
  }

  @Patch('manager/delivery/:id')
  public async onDeliveryCPOById(@Param('id') id: string) {
    return this.customerPurchaseOrdersService.deliveryCPOById(id);
  }

  @Patch('manager/delivery-completed/:id')
  public async deliveryCompletedCPOById(@Param('id') id: string) {
    return this.customerPurchaseOrdersService.deliveryCompletedCPOById(id);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoCancellation() {
    try {
      await this.customerPurchaseOrdersService.checkAndCancelExpiredCPOs();
    } catch (error) {
      console.error('Error in auto-cancellation cron job:', error);
    }
  }
}
