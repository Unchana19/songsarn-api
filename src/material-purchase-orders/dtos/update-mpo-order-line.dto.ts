import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateMpoOrderLineDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;
}
