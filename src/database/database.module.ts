import { Module, Global } from '@nestjs/common';
import { Pool, PoolConfig } from 'pg';
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
        };

        const pool = new Pool(config);

        try {
          const client = await pool.connect();
          console.log('Successfully connected to Neon database');
          client.release();
          return pool;
        } catch (error) {
          console.error('Error connecting to Neon database:', error);
          throw error;
        }
      },
    },
  ],
  exports: ['PG_CONNECTION'],
})
export class DatabaseModule {}
