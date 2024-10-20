import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MaterialsService } from './providers/materials.service';
import { CreateMaterialDto } from './dtos/create-material.dto';
import { UpdateMaterialDto } from './dtos/update-material.dto';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
  public async createMaterial(@Body() createMaterialDto: CreateMaterialDto) {
    return this.materialsService.create(createMaterialDto);
  }

  @Get()
  public async getAllMaterial() {
    return this.materialsService.getAllMaterials();
  }

  @Get('colors')
  public async getAllColors() {
    return this.materialsService.getAllColors();
  }

  @Patch()
  public async updateMaterial(@Body() updateMaterial: UpdateMaterialDto) {
    return this.materialsService.updateById(updateMaterial);
  }

  @Delete()
  public async deleteMaterial(@Query('id') id: string) {
    return this.materialsService.deleteById(id);
  }
}
