import { IsNumber, Min, Max } from 'class-validator';

export class CalculateDeliveryFeeDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  destinationLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  destinationLng: number;
}
