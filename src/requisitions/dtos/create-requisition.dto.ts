import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateRequisitionDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}
