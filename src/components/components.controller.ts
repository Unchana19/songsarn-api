import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ComponentsService } from './providers/components.service';
import { CreateComponentDto } from './dtos/create-component-dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateComponentDto } from './dtos/update-component.dto';

@Controller('components')
export class ComponentsController {
  constructor(private readonly componentsService: ComponentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  public async createComponent(
    @Body() createComponentDto: CreateComponentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.componentsService.create(createComponentDto, file);
  }

  @Get()
  public async getAllComponents() {
    return this.componentsService.getAll();
  }

  @Get('/:id')
  public async getBOMComponent(@Param('id') id: string) {
    return this.componentsService.getBOMById(id);
  }

  @Patch()
  @UseInterceptors(FileInterceptor('file'))
  public async updateComponent(
    @Body() updateComponentDto: UpdateComponentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.componentsService.updateById(updateComponentDto, file);
  }

  @Delete()
  public async deleteComponent(@Query('id') id: string) {
    return this.componentsService.deleteById(id);
  }
}
