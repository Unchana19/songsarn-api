import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CartsService } from './providers/carts.service';
import { AddToCartDto } from './dtos/add-to-cart.dto';

@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Post()
  public async addToCart(@Body() addToCartDto: AddToCartDto) {
    return this.cartsService.addToCart(addToCartDto);
  }

  @Get()
  public async getProductsInCartByOrderId(@Query('id') id: string) {
    return this.cartsService.getProductsInCartByOrderId(id);
  }

  @Patch('/:id/increase')
  async increaseQuantity(@Param('id') id: string) {
    return this.cartsService.increaseQuantity(id);
  }

  @Patch('/:id/decrease')
  async decreaseQuantity(@Param('id') id: string) {
    return this.cartsService.decreaseQuantity(id);
  }

  @Delete('/:id/delete')
  async deleteOrderByOrderId(@Param('id') id: string) {
    return this.cartsService.deleteOrderById(id);
  }
}
