import { getPresignedUrl } from '@/resources/s3/operations';
import { GetPdfUploadUrlResponse } from '@/types/upload.schema';
import { v4 as uuidv4 } from 'uuid';

class UploadService {
  constructor() {}
  async getPdfUploadUrl(filename: string, userId?: string): Promise<GetPdfUploadUrlResponse> {
    const id = uuidv4();
    const objectKey = this.getObjectKey(id, filename, userId);

    return { presignedUrl: await getPresignedUrl(objectKey), jobId: id, key: objectKey };
  }
  private getObjectKey(id: string, filename: string, userId?: string): string {
    if (userId) {
      return `bank-statements-auth/${userId}/${id}/${filename}`;
    }
    return `bank-statements/${id}/${filename}`;
  }
}

export default UploadService;
