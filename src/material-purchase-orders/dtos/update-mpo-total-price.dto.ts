import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateMPOTotalPriceDto {
  @IsString()
  @IsNotEmpty()
  mpo_id: string;

  @IsNumber()
  @IsNotEmpty()
  total_price: number;
}
