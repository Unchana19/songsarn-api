import { PartialType } from '@nestjs/swagger';
import { CreateMaterialDto } from './create-material.dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateMaterialDto extends PartialType(CreateMaterialDto) {
  @IsString()
  @IsNotEmpty()
  id: string;
}
