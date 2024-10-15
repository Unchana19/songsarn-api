import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MaterialItemDto } from './material-item.dto';
import { Type } from 'class-transformer';

export class CreateComponentDto {
  @IsString()
  @IsNotEmpty()
  category_id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialItemDto)
  materials: MaterialItemDto[];
}
