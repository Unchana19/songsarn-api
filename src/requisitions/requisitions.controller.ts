import { Body, Controller, Get, Post } from '@nestjs/common';
import { RequisitionsService } from './provider/requisitions.service';
import { CreateRequisitionDto } from './dtos/create-requisition.dto';

@Controller('requisitions')
export class RequisitionsController {
  constructor(private readonly requisitionService: RequisitionsService) {}

  @Post()
  public async createRequisition(
    @Body() createRequisitionDto: CreateRequisitionDto,
  ) {
    return this.requisitionService.create(createRequisitionDto);
  }

  @Get()
  public async getAllRequisition() {
    return this.requisitionService.getAllRequisition();
  }
}
