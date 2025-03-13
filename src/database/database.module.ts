import { Module, Global } from '@nestjs/common';
import { Pool, type PoolConfig } from 'pg';
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
        const config: PoolConfig = {
          connectionString: configService.get<string>('database.url'),
          ssl: true,

          // user: configService.get<string>('database.user'),
          // host: configService.get<string>('database.host'),
          // database: configService.get<string>('database.name'),
          // password: configService.get<string>('database.password'),
          // port: +configService.get<number>('database.port'),
        };

        const pool = new Pool(config);

        try {
          const client = await pool.connect();
          console.log('Successfully connected to local database');
          client.release();
          return pool;
        } catch (error) {
          console.error('Error connecting to local database:', error);
          throw error;
        }
      },
    },
  ],
  exports: ['PG_CONNECTION'],
})
export class DatabaseModule {}
