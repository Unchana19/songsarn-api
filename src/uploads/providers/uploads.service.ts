import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UploadToAwsProvider } from './upload-to-aws.provider';
import { ConfigService } from '@nestjs/config';
import { UploadFile } from '../interfaces/upload-file.interface';
import { fileTypes } from '../enums/file-types.enum';
import { DeleteFileAwsProvider } from './delete-file-aws.provider';

@Injectable()
export class UploadsService {
  constructor(
    private readonly uploadToAwsProvider: UploadToAwsProvider,
    private readonly deleteFileAwsProvider: DeleteFileAwsProvider,
    private readonly configService: ConfigService,
  ) {}

  public async uploadFile(file: Express.Multer.File, filename: string) {
    if (
      !['image/gif', 'image/jpeg', 'image/jpg', 'image/png'].includes(
        file.mimetype,
      )
    ) {
      throw new BadRequestException('Mime type not supported');
    }

    try {
      const path = await this.uploadToAwsProvider.fileupload(file, filename);

      const uploadFile: UploadFile = {
        name: path,
        path: `${this.configService.get<string>('appConfig.awsCloudFrontUrl')}/${path}`,
        type: fileTypes.IMAGE,
        mime: file.mimetype,
        size: file.size,
      };

      return this.configService.get('appConfig.awsS3Url') + uploadFile.name;
    } catch (error) {
      throw new ConflictException(error);
    }
  }

  public async deleteFile(filename: string): Promise<void> {
    try {
      await this.deleteFileAwsProvider.deleteFile(filename);
    } catch (error) {
      if (error instanceof NotFoundException) {
        console.warn(
          `File ${filename} not found in S3, considering it as already deleted.`,
        );
        return;
      }
      console.error('Error deleting file from S3:', error);
      throw new ConflictException(`Failed to delete file ${filename} from S3`);
    }
  }
}
