import { Controller, Post, Body } from '@nestjs/common';
import { DeliveryService } from './provider/delivery.service';
import { CalculateDeliveryFeeDto } from './dtos/calculate-delivery-fee.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { AuthType } from 'src/auth/enums/auth-type.enum';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('calculate-fee')
  @Auth(AuthType.None)
  public async calculateDeliveryFee(
    @Body() calculateDeliveryFeeDto: CalculateDeliveryFeeDto,
  ) {
    return this.deliveryService.calculateDeliveryFee(calculateDeliveryFeeDto);
  }
}
