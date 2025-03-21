import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AddToCartDto {
  @IsString()
  @IsNotEmpty()
  product_id: string;

  @IsString()
  @IsNotEmpty()
  order_id: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;
}
