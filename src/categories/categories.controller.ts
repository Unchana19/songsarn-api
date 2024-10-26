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
import { CategoriesService } from './providers/categories.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateCategoryDto } from './dtos/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  public async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.categoriesService.create(createCategoryDto, file);
  }

  @Get()
  public async getAllCategories() {
    return this.categoriesService.getAll();
  }

  @Get('/component-categories')
  public async getAllComponentCategories() {
    return this.categoriesService.getAllComponentCategories();
  }

  @Get('/:id')
  public async getBOMCategories(@Param('id') id: string) {
    return this.categoriesService.getBOMCategoriesById(id);
  }

  @Patch()
  @UseInterceptors(FileInterceptor('file'))
  public async updateCategory(
    @Body() updateCategoryDto: UpdateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.categoriesService.updateCategoryById(updateCategoryDto, file);
  }

  @Delete()
  public async deleteCategory(@Query('id') id: string) {
    return this.categoriesService.deleteCategoryById(id);
  }
}
