import { Module } from '@nestjs/common';
import { LikesController } from './likes.controller';
import { LikesService } from './providers/likes.service';

@Module({
  controllers: [LikesController],
  providers: [LikesService],
})
export class LikesModule {}
