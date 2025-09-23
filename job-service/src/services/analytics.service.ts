import { IJobAnalytics } from '@/types/models';
import { IJobRepository } from '@/repositories/job.repository';
import { SupabaseJobRepository } from '@/repositories/supabase.job.repository';
import { UnauthorizedError } from '@/utils/errors';

export class AnalyticsService {
  private readonly jobRepository: IJobRepository;
  private readonly userId: string;

  constructor(userId: string) {
    if (!userId) {
      throw new UnauthorizedError('User ID is required for analytics');
    }
    this.userId = userId;
    this.jobRepository = new SupabaseJobRepository();
  }

  /**
   * Gets analytics data for the user's jobs for the current month
   */
  async getAnalytics(): Promise<IJobAnalytics> {
    const now = new Date();
    const counts = await this.jobRepository.getJobCounts(this.userId);
    const processedCount = counts.completed + counts.failed;

    return {
      monthlyStats: {
        userId: this.userId,
        timestamp: now.toISOString(),
        totalJobs: counts.total,
        completedJobs: counts.completed,
        failedJobs: counts.failed,
        processedJobs: processedCount,
      },
    };
  }
}
