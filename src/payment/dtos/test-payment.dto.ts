import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class TestPaymentDto {
  @IsString()
  @IsNotEmpty()
  cpoId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
