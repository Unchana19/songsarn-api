import { Expose, Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { MaterialOrderLineDto } from './material-order-line.dto';

export class UpdateMpoOrderLineDto {
  @IsString()
  @IsNotEmpty()
  mpo_id: string;

  @IsString()
  @IsNotEmpty()
  payment_method: string;

  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialOrderLineDto)
  materials: MaterialOrderLineDto[];
}
