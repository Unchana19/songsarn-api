import { PartialType } from '@nestjs/swagger';
import { CreateComponentDto } from './create-component-dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateComponentDto extends PartialType(CreateComponentDto) {
  @IsString()
  @IsNotEmpty()
  id: string;
}
