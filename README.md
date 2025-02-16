
## Overview

This is e-commerce for Shirne's shop. This project started from the System Analysis course.
This is API for the website


## Tech Stack

- [Nest.js](https://docs.nestjs.com/)
- [TypeScript](https://www.typescriptlang.org/)

## Environment Variables

Create a `.env.local` file in the root directory and add the following environment variables:

```env
DATABASE_PORT=""
DATABASE_USER=""
DATABASE_PASSWORD=""
DATABASE_HOST=""
DATABASE_NAME=""

DATABASE_URL=""

JWT_SECRET=""
JWT_TOKEN_AUDIENCE=""
JWT_TOKEN_ISSUER=""
JWT_ACCESS_TOKEN_TTL=""
JWT_REFRESH_TOKEN_TTL=""

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

AWS_PUBLIC_BUCKET_NAME=""
AWS_REGION=""
AWS_CLOUDFRONT_URL=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_URL=""

PROMPTPAY_MOBILE_NUMBER=""
BANK_ACCOUNT_NAME=""
SLIPOK_API_KEY=""
SLIPOK_ENDPOINTS=""
```


## Demo
You can use one of them `npm`, `yarn`, `pnpm`, `bun`, Example using `npm` and ensure you have a `.env.local` file.

#### Install dependencies

```bash
  npm install
```

#### Run the development server
```bash
  npm run start:dev
```

