import { z } from "zod";

export const getPdfUploadUrlSchema = z.object({
    filename: z.string(),
});

export type GetPdfUploadUrlSchema = z.infer<typeof getPdfUploadUrlSchema>;

export interface GetPdfUploadUrlResponse {
    presignedUrl: string;
    jobId: string;
    key: string;
}