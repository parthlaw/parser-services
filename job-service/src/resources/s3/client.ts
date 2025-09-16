import { S3Client } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

export const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client();
  }
  return s3Client;
};

export const closeS3Connection = async (): Promise<void> => {
  if (s3Client) {
    s3Client.destroy();
    s3Client = null;
  }
};
