import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  ValidateIf,
  Length,
} from 'class-validator';
import { IsEqualTo } from '../decorators/is-equal-to.decorator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(96)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(96)
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Phone number must be exactly 10 characters' })
  @Matches(/^[0-9]+$/, { message: 'Phone number must contain only numbers' })
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  @ValidateIf((o) => o.password !== undefined)
  @IsEqualTo('password', {
    message: 'Confirm password must match the password',
  })
  confirmPassword: string;
}
