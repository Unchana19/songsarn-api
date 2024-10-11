import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { MaterialItemDto } from './add-material-to-mpo.dto';
import { Expose, Type } from 'class-transformer';

export class CreateMaterialPurchaseOrderDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  supplier: string;

  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialItemDto)
  material: MaterialItemDto[];
}
