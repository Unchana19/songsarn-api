import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './providers/uploads.service';
import { UploadToAwsProvider } from './providers/upload-to-aws.provider';
import { DeleteFileAwsProvider } from './providers/delete-file-aws.provider';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, UploadToAwsProvider, DeleteFileAwsProvider],
  exports: [UploadsService],
})
export class UploadsModule {}
