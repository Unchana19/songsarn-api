import { IsString } from 'class-validator';

export class GetUserParamDto {
  @IsString()
  id: string;
}
