import UploadService from '@/services/upload.service';
import ApiResponseHandler from '@/utils/apiResponseHandler';
import { Request, Response } from 'express';
import { getPdfUploadUrlSchema } from '@/types/upload.schema';
const getUploadService = (): UploadService => {
  return new UploadService();
};

export const getPdfUploadUrl = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { filename } = getPdfUploadUrlSchema.parse(req.query);
  const { presignedUrl, jobId, key } = await getUploadService().getPdfUploadUrl(filename, userId);
  ApiResponseHandler.success(
    res,
    { presignedUrl, jobId, key },
    'PDF upload URL generated successfully'
  );
};
