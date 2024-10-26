import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ComponentCategoriesDto } from './component-categoires.dto';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ComponentCategoriesDto)
  componentCategories?: ComponentCategoriesDto[];
}
