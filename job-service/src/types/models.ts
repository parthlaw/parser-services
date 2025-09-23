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
  total: number;
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
  pdfPages?: number;
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    has_more: boolean;
  };
  status: JobStatus;
  deleted?: boolean;
}

// ---------- User Gateway ID ----------
export interface IUserGatewayId {
  user_id: string;
  gateway_user_id: string;
  created_at: string;
}

export interface ICreateUserGatewayIdInput {
  user_id: string;
  gateway_user_id: string;
}

// ---------- Bundles ----------
export interface IBundle {
  id: string;
  user_id: string;
  bundle_type: string;
  pages: number;
  price: number;
  currency: string;
  purchased_at: string;
  valid_until: string | null;
  invoice_id: string | null;
  invoice_line_item_id: string | null;
}

export interface ICreateBundleInput {
  id: string;
  user_id: string;
  bundle_type: string;
  pages: number;
  price: number;
  currency?: string;
  purchased_at?: string;
  valid_until?: string | null;
  invoice_id?: string | null;
  invoice_line_item_id?: string | null;
}

export interface IUpdateBundleInput {
  id: string;
  bundle_type?: string;
  pages?: number;
  price?: number;
  currency?: string;
  valid_until?: string | null;
}

// ---------- Subscriptions ----------
export interface ISubscription {
  id: string;
  user_id: string;
  currency: string;
  start_date: string;
  end_date: string;
  subscription_id: string | null;
  item_price_id: string | null;
  status: string;
  pageCredits?: number;
}

export interface ICreateSubscriptionInput {
  id: string;
  user_id: string;
  currency?: string;
  start_date: string;
  end_date: string;
  subscription_id?: string | null;
  item_price_id?: string | null;
  status?: string;
}

export interface IUpdateSubscriptionInput {
  id: string;
  currency?: string;
  start_date?: string;
  end_date?: string;
  subscription_id?: string | null;
  item_price_id?: string | null;
  status?: string;
}

// ---------- Page Credits ----------
export interface IPageCreditBalance {
  reference_id: string;
  source_type: string;
  expires_at: string | null;
  balance: number;
}

export interface IPageCredit {
  id: string;
  user_id: string;
  change: number;
  reason: string;
  source_type: string;
  reference_id: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface ICreatePageCreditInput {
  id: string;
  user_id: string;
  change: number;
  reason: string;
  source_type: string;
  reference_id?: string | null;
  created_at?: string;
  expires_at?: string | null;
}

export interface IUpdatePageCreditInput {
  id: string;
  change?: number;
  reason?: string;
  source_type?: string;
  reference_id?: string | null;
  expires_at?: string | null;
}

// ---------- Download URL ----------
export type SupportedDownloadFormat = 'csv' | 'json' | 'xlsx' | 'jsonl';

export interface IDownloadUrlOptions {
  jobId: string;
  format: SupportedDownloadFormat;
  expiresIn?: number;
}

export interface IDownloadUrlResult {
  downloadUrl: string;
  expiresIn: number;
  format: SupportedDownloadFormat;
  jobId: string;
}

// ---------- Analytics ----------
export interface IJobAnalytics {
  monthlyStats: {
    userId: string;
    timestamp: string;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    processedJobs: number;
  };
}

// ---------- Job List ----------
export interface IJobListItem {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface IJobListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface IJobListResponse {
  jobs: IJobListItem[];
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pagination: IJobListPagination;
}

export interface IJobListFilters {
  page?: number | undefined;
  limit?: number | undefined;
  status?: string | undefined;
  filename?: string | undefined;
}
