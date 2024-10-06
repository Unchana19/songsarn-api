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
import { UserAuth } from '../interfaces/user.interface';
import { HashingProvider } from 'src/auth/providers/hashing.provider';
import { FindOneUserByEmailProvider } from './find-one-user-by-email.provider';
import { GetUserParamDto } from '../dtos/get-user-param.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,

    @Inject(forwardRef(() => HashingProvider))
    private readonly hashingProvider: HashingProvider,

    private readonly findOneUserByEmailProvider: FindOneUserByEmailProvider,
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

  public async findOneById(
    getUserParamDto: GetUserParamDto,
  ): Promise<UserAuth | null> {
    const query = `
      SELECT id, email, password, role, img
      FROM users
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [getUserParamDto.id]);

    return rows.length > 0 ? rows[0] : null;
  }

  public async findOneByEmail(email: string) {
    return this.findOneUserByEmailProvider.findOneByEmail(email);
  }
}
