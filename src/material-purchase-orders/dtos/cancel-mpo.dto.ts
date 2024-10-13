import { IsNotEmpty, IsString } from 'class-validator';

export class CancelMpoDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
