import {
  Body,
  Controller,
  HttpException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  PaymentService,
  VerificationResult,
} from './providers/payment.service';
import { GenerateQRCodeDto } from './dtos/generate-qr-code.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { SlipVerifyDto } from './dtos/slip-verify.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('generate-qr')
  public async generateQR(@Body() generateQRCodeDto: GenerateQRCodeDto) {
    return await this.paymentService.generateQRCode(generateQRCodeDto);
  }

  @Post('verify-slip')
  @UseInterceptors(FileInterceptor('file'))
  public async verifySlip(
    @Body() slipVerifyDto: SlipVerifyDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<VerificationResult> {
    const result = await this.paymentService.verifySlip(slipVerifyDto, file);

    if (!result.success) {
      throw new HttpException(
        {
          statusCode: 400,
          message: result.message,
          error: result.error,
          details: result.details,
        },
        400,
      );
    }

    return result;
  }
}
