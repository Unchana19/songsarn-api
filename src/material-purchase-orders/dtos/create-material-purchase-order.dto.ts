import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { MaterialItemDto } from './material-item.dto';
import { Type } from 'class-transformer';

export class CreateMaterialPurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  supplier: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialItemDto)
  material: MaterialItemDto[];
}
