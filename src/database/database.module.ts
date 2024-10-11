import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from './providers/database.service';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: 'PG_CONNECTION',
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const pool = new Pool({
          user: configService.get<string>('database.user'),
          host: configService.get<string>('database.host'),
          database: configService.get<string>('database.name'),
          password: configService.get<string>('database.password'),
          port: +configService.get<number>('database.port'),
        });

        await pool.connect();
        return pool;
      },
    },
  ],
  exports: ['PG_CONNECTION'],
})
export class DatabaseModule {}
