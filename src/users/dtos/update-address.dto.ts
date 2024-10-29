import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class UpdateAddressDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsString()
  @IsNotEmpty()
  address: string;
}
