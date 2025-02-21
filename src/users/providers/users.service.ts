import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Pool } from 'pg';
import { CreateUserDto } from '../dtos/create-user.dto';
import { v4 as uuidv4 } from 'uuid';
import { User, UserAuth } from '../interfaces/user.interface';
import { HashingProvider } from 'src/auth/providers/hashing.provider';
import { FindOneUserByEmailProvider } from './find-one-user-by-email.provider';
import { GetUserParamDto } from '../dtos/get-user-param.dto';
import { FindOneByGoogleIdProvider } from './find-one-by-google-id.provider';
import { CreateGoogleUserProvider } from './create-google-user.provider';
import { GoogleUser } from '../interfaces/google-user.interface';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { UploadsService } from 'src/uploads/providers/uploads.service';
import { UpdateAddressDto } from '../dtos/update-address.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,

    @Inject(forwardRef(() => HashingProvider))
    private readonly hashingProvider: HashingProvider,

    private readonly findOneUserByEmailProvider: FindOneUserByEmailProvider,
    private readonly findOneByGoogleIdProvider: FindOneByGoogleIdProvider,
    private readonly createGoogleUserProvider: CreateGoogleUserProvider,
    private readonly uploadsService: UploadsService,
  ) {}

  public async createUser(createUserDto: CreateUserDto) {
    const { name, email, phoneNumber, password, confirmPassword } =
      createUserDto;

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    const existingUser = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );

    if (existingUser.rows.length > 0) {
      throw new HttpException('User already exists', HttpStatus.BAD_REQUEST);
    }

    const userId = uuidv4();
    const hashingPassword = await this.hashingProvider.hashPassword(password);

    await this.db.query(
      'INSERT INTO users (id, email, password, name, role, phone_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, email, hashingPassword, name, 'customer', phoneNumber],
    );

    const user = await this.findOneById(userId);

    return user;
  }

  public async createStaff(createUserDto: CreateUserDto) {
    const { name, email, phoneNumber, password, confirmPassword } =
      createUserDto;

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    const existingUser = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );

    if (existingUser.rows.length > 0) {
      throw new HttpException('User already exists', HttpStatus.BAD_REQUEST);
    }

    const userId = uuidv4();
    const hashingPassword = await this.hashingProvider.hashPassword(password);

    await this.db.query(
      'INSERT INTO users (id, email, password, name, role, phone_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, email, hashingPassword, name, 'staff', phoneNumber],
    );

    const user = await this.findOneById(userId);

    return user;
  }

  public async findStaff() {
    const query = `
      SELECT id, 
        email, 
        name, 
        role, 
        img, 
        phone_number, 
        address,
        CAST(lat AS FLOAT) as lat,
        CAST(lng AS FLOAT) as lng
      FROM users
      WHERE role = 'staff'
    `;

    const { rows } = await this.db.query(query);

    return rows;
  }

  public async deleteStaff(getUserParamDto: GetUserParamDto) {
    const query = `
      DELETE FROM users
      WHERE id = $1
    `;
    await this.db.query(query, [getUserParamDto.id]);
  }

  public async findOneById(
    getUserParamDto: GetUserParamDto,
  ): Promise<UserAuth | null> {
    const query = `
      SELECT id, 
        email, 
        password, 
        name, 
        role, 
        img, 
        phone_number, 
        address,
        CAST(lat AS FLOAT) as lat,
        CAST(lng AS FLOAT) as lng
      FROM users
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [getUserParamDto.id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async getUserInfoById(
    getUserParamDto: GetUserParamDto,
  ): Promise<User | null> {
    const query = `
      SELECT id, email, name, role, img, phone_number, address, lat, lng
      FROM users
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [getUserParamDto.id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async updateUserById(
    updateProfileDto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    const { id, name, phone_number } = updateProfileDto;

    const query = `
    UPDATE users
    SET name = $1,
      phone_number = $2
    WHERE id = $3
    RETURNING *
    `;

    const { rows } = await this.db.query(query, [name, phone_number, id]);

    if (file) {
      await this.updateImg(id, file);
    }

    return rows.length > 0 ? rows[0] : null;
  }

  public async updateImg(id: string, file?: Express.Multer.File) {
    const existingUser = await this.findOneById({ id });

    if (!existingUser) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const filename = await this.uploadsService.uploadFile(file, id);

    const query = `
    UPDATE users
    SET img = $1
    WHERE id = $2
    RETURNING *
    `;

    const { rows } = await this.db.query(query, [filename, id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async updateAddressById(updateAddressDto: UpdateAddressDto) {
    const { id, lat, lng, address } = updateAddressDto;

    const query = `
    UPDATE users
    SET lat = $1,
      lng = $2,
      address = $3
    WHERE id = $4
    RETURNING *
    `;

    const { rows } = await this.db.query(query, [lat, lng, address, id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async findOneByEmail(email: string) {
    return this.findOneUserByEmailProvider.findOneByEmail(email);
  }

  public async findOneByGoogleId(googleId: string) {
    return this.findOneByGoogleIdProvider.findOneByGoogleId(googleId);
  }

  public async createGoogleUser(googleUser: GoogleUser) {
    return this.createGoogleUserProvider.createGoogleUser(googleUser);
  }
}
