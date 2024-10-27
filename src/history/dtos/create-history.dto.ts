import { IsNotEmpty, IsString } from 'class-validator';

export class CreateHistoryDto {
  @IsString()
  @IsNotEmpty()
  cpo_id: string;

  @IsString()
  @IsNotEmpty()
  status: string;
}
