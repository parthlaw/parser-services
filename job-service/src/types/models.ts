// ---------- Jobs ----------
export enum JobStatus {
  // PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export interface IJob {
  id: string; // UUID for Supabase, custom UUID for DynamoDB
  user_id: string | undefined; // Optional for anonymous users
  source_key: string;
  status: JobStatus;
  result_s3_path: string | undefined;
  filename: string | undefined;
  result_score: number | undefined;
  num_pages: number | undefined;
  created_at: string;
  updated_at: string;
}

export interface ICreateJobInput {
  user_id?: string;
  sourceKey: string;
  filename: string;
  job_id: string;
}

export interface IUpdateJobInput {
  id: string;
  status?: JobStatus;
  result_s3_path?: string;
  result_score?: number;
  num_pages?: number;
}
export interface IJsonlPaginationOptions {
  offset: number;
  limit: number;
}

export interface IJsonlReadResult<T> {
  data: T[];
  hasMore: boolean;
  totalRead: number;
}

export interface IJsonlFileMetadata {
  filePath: string;
  totalLines?: number;
  lastOffset?: number;
}

export interface IBankStatementResults {
  transactions: Record<string, any>[];
  total: number;
  hasMore: boolean;
  status: JobStatus;
}