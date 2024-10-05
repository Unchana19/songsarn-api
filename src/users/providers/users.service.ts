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
import { User } from '../interfaces/user.interface';
import { HashingProvider } from 'src/auth/providers/hashing.provider';

@Injectable()
export class UsersService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,

    @Inject(forwardRef(() => HashingProvider))
    private readonly hashingProvider: HashingProvider,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
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
      'INSERT INTO users (id, email, password, name, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, email, hashingPassword, name, phoneNumber],
    );

    const user = await this.findOneUserById(userId);

    return user;
  }

  async findOneUserById(userId: string): Promise<User | null> {
    const query = `
      SELECT id, name, email, phone_number
      FROM users
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [userId]);

    return rows.length > 0 ? rows[0] : null;
  }
}
