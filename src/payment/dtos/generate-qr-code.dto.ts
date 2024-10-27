import { IsNotEmpty, IsNumber } from 'class-validator';

export class GenerateQRCodeDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
