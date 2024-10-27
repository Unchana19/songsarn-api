import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CustomerPurchaseOrdersService } from './provider/customer-purchase-orders.service';
import { CreateCPODto } from './dtos/create-cpo.dto';

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

  @Get('detail')
  public async getCPOById(@Query('id') id: string) {
    return this.customerPurchaseOrdersService.getCPOById(id);
  }
}
