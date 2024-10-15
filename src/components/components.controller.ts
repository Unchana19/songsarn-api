import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ComponentsService } from './providers/components.service';
import { CreateComponentDto } from './dtos/create-component-dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('components')
export class ComponentsController {
  constructor(private readonly componentsService: ComponentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  public async create(
    @Body() createComponentDto: CreateComponentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.componentsService.create(createComponentDto, file);
  }
}
