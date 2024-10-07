import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class FindOneByGoogleIdProvider {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async findOneByGoogleId(googleId: string) {
    const query = `
      SELECT id, email, name, role, img
      FROM users
      WHERE id = $1
    `;

    const { rows } = await this.db.query(query, [googleId]);

    return rows.length > 0 ? rows[0] : null;
  }
}
