import { IsNotEmpty, IsString } from 'class-validator';

export class ComponentCategoriesDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
