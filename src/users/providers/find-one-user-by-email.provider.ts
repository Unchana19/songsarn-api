import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { UserAuth } from '../interfaces/user.interface';

@Injectable()
export class FindOneUserByEmailProvider {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async findOneByEmail(email: string): Promise<UserAuth | null> {
    const query = `
      SELECT id, email, password, role, img
      FROM users
      WHERE email = $1
    `;

    const { rows } = await this.db.query(query, [email]);

    return rows.length > 0 ? rows[0] : null;
  }
}
