import { IsNotEmpty, IsString } from 'class-validator';

export class AddLikeDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  product_id: string;
}
