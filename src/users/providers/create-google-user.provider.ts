import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { GoogleUser } from '../interfaces/google-user.interface';
import { FindOneByGoogleIdProvider } from './find-one-by-google-id.provider';

@Injectable()
export class CreateGoogleUserProvider {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,

    private readonly findOneByGoogleIdProvider: FindOneByGoogleIdProvider,
  ) {}

  public async createGoogleUser(googleUser: GoogleUser) {
    try {
      await this.db.query(
        'INSERT INTO users (id, email, name, role, img) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [
          googleUser.googleId,
          googleUser.email,
          googleUser.name,
          'customer',
          googleUser.img,
        ],
      );

      const user = await this.findOneByGoogleIdProvider.findOneByGoogleId(
        googleUser.googleId,
      );

      return user;
    } catch (error) {
      throw new ConflictException(error, {
        description: 'Could Not Create A New User',
      });
    }
  }
}
