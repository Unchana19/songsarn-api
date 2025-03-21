import * as Joi from 'joi';

export default Joi.object({
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_HOST: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_USER: Joi.string().required(),
  AWS_PUBLIC_BUCKET_NAME: Joi.string().required(),
  AWS_REGION: Joi.string().required(),
  AWS_CLOUDFRONT_URL: Joi.string().required(),
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_S3_URL: Joi.string().required(),
  PROMPTPAY_MOBILE_NUMBER: Joi.string().required(),
  SLIPOK_API_KEY: Joi.string().required(),
  SLIPOK_ENDPOINTS: Joi.string().required(),
  BANK_ACCOUNT_NAME: Joi.string().required(),
});
