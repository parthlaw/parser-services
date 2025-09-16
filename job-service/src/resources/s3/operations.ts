import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  _Object as S3Object,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from './client';
import getEnvVar from '../../config/environment';

const defaultBucket = getEnvVar.AWS_S3_BUCKET;

export const uploadFile = async (
  key: string,
  body: Buffer | string,
  contentType?: string,
  bucket: string = defaultBucket
): Promise<void> => {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
};

export const downloadFile = async (
  key: string,
  bucket: string = defaultBucket
): Promise<GetObjectCommandOutput> => {
  const client = getS3Client();
  return client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
};

export const deleteFile = async (
  key: string,
  bucket: string = defaultBucket
): Promise<void> => {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
};

export const checkFileExists = async (
  key: string,
  bucket: string = defaultBucket
): Promise<boolean> => {
  const client = getS3Client();
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    if ((error as any)?.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};

export const downloadFileToDisk = async (
  key: string,
  localPath: string,
  bucket: string = defaultBucket
): Promise<void> => {
  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error('Empty response body from S3');
  }

  // Create write stream to save file
  const { pipeline } = await import('stream/promises');
  const { createWriteStream } = await import('fs');
  
  await pipeline(
    response.Body as NodeJS.ReadableStream,
    createWriteStream(localPath)
  );
};

export const listFiles = async (
  prefix?: string,
  bucket: string = defaultBucket
): Promise<S3Object[]> => {
  const client = getS3Client();
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });

  const response = await client.send(command);
  return response.Contents || [];
};

export const getPresignedUrl = async (
  key: string,
  bucket: string = defaultBucket
): Promise<string> => {
  const client = getS3Client();
  // Presigned url to Put object
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const url = await getSignedUrl(client, command, { expiresIn: 3600 });
  return url;
};