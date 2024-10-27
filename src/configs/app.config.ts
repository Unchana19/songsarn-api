import { registerAs } from '@nestjs/config';

export default registerAs('appConfig', () => ({
  awsBucketName: process.env.AWS_PUBLIC_BUCKET_NAME,
  awsRegion: process.env.AWS_REGION,
  awsCloudFrontUrl: process.env.AWS_CLOUDFRONT_URL,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsS3Url: process.env.AWS_S3_URL,
  promptpayMobileNumber: process.env.PROMPTPAY_MOBILE_NUMBER,
  slipokApiKey: process.env.SLIPOK_API_KEY,
  slipokEndpoint: process.env.SLIPOK_ENDPOINTS,
}));
