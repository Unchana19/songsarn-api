import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { AddLikeDto } from '../dtos/add-like.dto';

@Injectable()
export class LikesService {
  constructor(
    @Inject('PG_CONNECTION')
    private readonly db: Pool,
  ) {}

  public async addLike(addLikeDto: AddLikeDto) {
    const { product_id, user_id } = addLikeDto;

    const id = uuidv4();

    const like = await this.db.query(
      'INSERT INTO likes (id, product_id, user_id) VALUES ($1, $2, $3) RETURNING *',
      [id, product_id, user_id],
    );

    return like;
  }

  public async getLikesByUserId(user_id: string) {
    const query = `
      SELECT 
        l.id AS id,
        l.product_id AS product_id,
        p.name AS name,
        p.img AS img,
        p.price AS price
      FROM likes l
      JOIN products p
      ON l.product_id = p.id
      WHERE l.user_id = $1
      ORDER BY l.created_at DESC
    `;

    const { rows } = await this.db.query(query, [user_id]);

    return rows;
  }

  public async removeLike(id: string) {
    const query = 'DELETE FROM likes WHERE id = $1';
    await this.db.query(query, [id]);

    return { id };
  }
}
