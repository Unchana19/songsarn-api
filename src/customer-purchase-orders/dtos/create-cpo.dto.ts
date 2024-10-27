import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { OrderLineItemDto } from './order-line-item.dto';
import { Type } from 'class-transformer';

export class CreateCPODto {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsNumber()
  @IsNotEmpty()
  delivery_price: number;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  @IsNotEmpty()
  total_price: number;

  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @IsString()
  @IsNotEmpty()
  payment_method: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineItemDto)
  order_lines: OrderLineItemDto[];
}
