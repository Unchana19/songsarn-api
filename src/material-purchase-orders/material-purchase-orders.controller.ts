import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { MaterialPurchaseOrdersService } from './providers/material-purchase-orders.service';
import { CreateMaterialPurchaseOrderDto } from './dtos/create-material-purchase-order.dto';
import { UpdateMpoOrderLineDto } from './dtos/update-mpo-order-line.dto';
import { CancelMpoDto } from './dtos/cancel-mpo.dto';
import { ReceiveMPODto } from './dtos/receive-mpo.dto';

@Controller('material-purchase-orders')
export class MaterialPurchaseOrdersController {
  constructor(
    private readonly materialPurchaseOrdersService: MaterialPurchaseOrdersService,
  ) {}

  @Post()
  public async createMaterialPurchaseOrder(
    @Body() createMaterialPurchaseOrderDto: CreateMaterialPurchaseOrderDto,
  ) {
    return this.materialPurchaseOrdersService.createMPO(
      createMaterialPurchaseOrderDto,
    );
  }

  @Get()
  public async getAllMaterialPurchaseOrder() {
    return this.materialPurchaseOrdersService.getAllMPO();
  }

  @Get('/:id')
  public async findOneMaterialPurchaseOrder(@Param('id') id: string) {
    return this.materialPurchaseOrdersService.findOneById(id);
  }

  @Post('/mpo-order-line')
  public async updatePriceMpoOrderLine(
    @Body() updateMpoOrderLineDto: UpdateMpoOrderLineDto,
  ) {
    return this.materialPurchaseOrdersService.updatePriceMpoOrderLine(
      updateMpoOrderLineDto,
    );
  }

  @Patch('/cancel')
  public async cancelMPO(@Body() cancelMpoDto: CancelMpoDto) {
    return this.materialPurchaseOrdersService.cancelMPOById(cancelMpoDto);
  }

  @Patch('/receive')
  public async receiveMPO(@Body() receiveMPODto: ReceiveMPODto) {
    return this.materialPurchaseOrdersService.receiveMPOById(receiveMPODto);
  }
}
