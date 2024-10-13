import { IsNotEmpty, IsString } from 'class-validator';

export class ReceiveMPODto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
