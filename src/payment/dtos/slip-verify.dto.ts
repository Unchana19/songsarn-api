import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SlipVerifyDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsNumber()
  @IsNotEmpty()
  expectedAmount: number;
}
