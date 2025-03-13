import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { LikesService } from './providers/likes.service';
import { AddLikeDto } from './dtos/add-like.dto';

@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  public async addLike(@Body() addLikeDto: AddLikeDto) {
    return this.likesService.addLike(addLikeDto);
  }

  @Get()
  public async getLikesByUserId(@Query('userId') user_id: string) {
    return this.likesService.getLikesByUserId(user_id);
  }

  @Delete()
  public async removeLike(@Query('id') id: string) {
    return this.likesService.removeLike(id);
  }
}
