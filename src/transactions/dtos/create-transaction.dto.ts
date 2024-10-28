import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  po_id: string;

  @IsString()
  @IsNotEmpty()
  type: 'cpo' | 'mpo';
}
