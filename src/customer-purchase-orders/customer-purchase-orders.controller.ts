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
}
