import { IsNotEmpty, IsString } from 'class-validator';

export class ComponentItemsDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  primary_color: string;

  @IsString()
  @IsNotEmpty()
  pattern_color: string;
}
