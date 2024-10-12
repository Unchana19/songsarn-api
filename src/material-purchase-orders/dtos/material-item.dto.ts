import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class MaterialItemDto {
  @IsString()
  @IsNotEmpty()
  material_id: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  requisition_id: string;
}
