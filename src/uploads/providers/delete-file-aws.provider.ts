import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';

@Injectable()
export class DeleteFileAwsProvider {
  private readonly s3: S3;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('appConfig.awsBucketName');

    this.s3 = new S3({
      accessKeyId: this.configService.get<string>('appConfig.awsAccessKeyId'),
      secretAccessKey: this.configService.get<string>(
        'appConfig.awsSecretAccessKey',
      ),
      region: this.configService.get<string>('appConfig.awsRegion'),
    });
  }

  private extractKeyFromUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.pathname.replace(/^\//, '');
    } catch (error) {
      console.error('Failed to parse URL:', error);
      return url;
    }
  }

  public async deleteFile(fileUrl: string): Promise<void> {
    const key = this.extractKeyFromUrl(fileUrl);

    const params = {
      Bucket: this.bucketName,
      Key: key,
    };

    try {
      try {
        await this.s3.headObject(params).promise();
      } catch (headError) {
        if (headError.code === 'NotFound') {
          console.log(`File ${key} does not exist, considering it as deleted`);
          return;
        }
        throw headError;
      }

      await this.s3.deleteObject(params).promise();
      try {
        await this.s3.headObject(params).promise();
        throw new Error(`Failed to delete file ${key}`);
      } catch (postDeleteHeadError) {
        if (postDeleteHeadError.code === 'NotFound') {
          console.log(`File ${key} successfully deleted`);
        } else {
          throw postDeleteHeadError;
        }
      }
    } catch (error) {
      console.error(`Error in deleteFile:`, error);
      throw new InternalServerErrorException(
        `Failed to delete file ${key}: ${error.message}`,
      );
    }
  }
}
