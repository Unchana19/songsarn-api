import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateTransactionDto {
  @IsString()
  @IsNotEmpty()
  po_id: string;

  @IsString()
  @IsNotEmpty()
  payment_method: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
