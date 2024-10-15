import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';

@Injectable()
export class DeleteFileAwsProvider {
  private readonly s3: S3;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('appConfig.awsBucketName');
    if (!this.bucketName) {
      console.error('AWS S3 bucket name is not defined in the configuration');
      throw new InternalServerErrorException(
        'S3 bucket name is not configured',
      );
    }

    this.s3 = new S3({
      accessKeyId: this.configService.get<string>('appConfig.awsAccessKeyId'),
      secretAccessKey: this.configService.get<string>(
        'appConfig.awsSecretAccessKey',
      ),
      region: this.configService.get<string>('appConfig.awsRegion'),
    });
  }

  public async deleteFile(filename: string): Promise<void> {
    const params = {
      Bucket: this.bucketName,
      Key: filename,
    };

    try {
      console.log(`Attempting to delete file: ${filename}`);
      const result = await this.s3.deleteObject(params).promise();
      console.log(`Delete result:`, result);
      try {
        await this.s3.headObject(params).promise();
        throw new Error(`Failed to delete file ${filename}`);
      } catch (headError) {
        if (headError.code === 'NotFound') {
          console.log(`File ${filename} successfully deleted`);
        } else {
          throw headError;
        }
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to delete file ${filename}: ${error.message}`,
      );
    }
  }
}
