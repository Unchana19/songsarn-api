import { Injectable } from '@nestjs/common';
import { CalculateDeliveryFeeDto } from '../dtos/calculate-delivery-fee.dto';

interface Coordinates {
  lat: number;
  lng: number;
}

@Injectable()
export class DeliveryService {
  private readonly PRICE_PER_KM = 35;
  private readonly FIXED_ORIGIN: Coordinates = {
    lat: 14.753134188697322,
    lng: 100.43414511059936,
  };

  private calculateDistance(origin: Coordinates, destination: Coordinates) {
    const R = 6371;

    const dLat = this.toRad(destination.lat - origin.lat);
    const dLon = this.toRad(destination.lng - origin.lng);

    const lat1 = this.toRad(origin.lat);
    const lat2 = this.toRad(destination.lat);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Number(distance.toFixed(2));
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  calculateDeliveryFee(calculateDeliveryFeeDto: CalculateDeliveryFeeDto) {
    const destination = {
      lat: calculateDeliveryFeeDto.destinationLat,
      lng: calculateDeliveryFeeDto.destinationLng,
    };
    const distance = this.calculateDistance(this.FIXED_ORIGIN, destination);
    const fee = Math.floor(distance * this.PRICE_PER_KM);

    return {
      fee,
    };
  }
}
