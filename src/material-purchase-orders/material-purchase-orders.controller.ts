import { Body, Controller, Post } from '@nestjs/common';
import { MaterialPurchaseOrdersService } from './providers/material-purchase-orders.service';
import { CreateMaterialPurchaseOrderDto } from './dtos/create-material-purchase-order.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { AuthType } from 'src/auth/enums/auth-type.enum';

@Controller('material-purchase-orders')
export class MaterialPurchaseOrdersController {
  constructor(
    private readonly materialPurchaseOrdersService: MaterialPurchaseOrdersService,
  ) {}

  @Post()
  @Auth(AuthType.None)
  public async createMaterialPurchaseOrder(
    @Body() createMaterialPurchaseOrderDto: CreateMaterialPurchaseOrderDto,
  ) {
    return this.materialPurchaseOrdersService.createMPO(
      createMaterialPurchaseOrderDto,
    );
  }
}
