import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class MaterialOrderLineDto {
  @IsString()
  @IsNotEmpty()
  mpo_ol_id: string;

  @IsNumber()
  @IsNotEmpty()
  material_price: number;
}
