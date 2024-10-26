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
import { ProductsService } from './providers/products.service';
import { CreateProductDto } from './dtos/create-product.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateProductDto } from './dtos/update-product.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { AuthType } from 'src/auth/enums/auth-type.enum';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  public async createComponent(
    @Body() createProductDto: CreateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.productsService.create(createProductDto, file);
  }

  @Get()
  @Auth(AuthType.None)
  public async getAllProducts() {
    return this.productsService.getAll();
  }

  @Get('find-by-id')
  @Auth(AuthType.None)
  public async findProductsById(@Query('id') id: string) {
    return this.productsService.findOneById(id);
  }

  @Get('find-by-category')
  @Auth(AuthType.None)
  public async findProductsByCategory(@Query('categoryId') categoryId: string) {
    return this.productsService.findByCategory(categoryId);
  }

  @Get('/:id')
  public async getBOMProducts(@Param('id') id: string) {
    return this.productsService.getBOM(id);
  }

  @Patch()
  @UseInterceptors(FileInterceptor('file'))
  public async updateProduct(
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.productsService.updateById(updateProductDto, file);
  }

  @Delete()
  public async deleteProduct(@Query('id') id: string) {
    return this.productsService.deleteById(id);
  }
}
