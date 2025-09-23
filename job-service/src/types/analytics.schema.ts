import { z } from 'zod';

// No input schema needed for analytics as it only requires authentication
// which is handled by the middleware

export const analyticsResponseSchema = z.object({
  totalProcessed: z.object({
    value: z.number(),
    percentageChange: z.number(),
    changeText: z.string(),
    description: z.string().optional(),
  }),
  thisMonth: z.object({
    value: z.number(),
    percentageChange: z.number(),
    changeText: z.string(),
    description: z.string().optional(),
  }),
  processingTime: z.object({
    value: z.object({
      averageSeconds: z.number(),
      displayText: z.string(),
    }),
    percentageChange: z.number(),
    changeText: z.string(),
    description: z.string().optional(),
  }),
  successRate: z.object({
    value: z.object({
      percentage: z.number(),
      displayText: z.string(),
    }),
    percentageChange: z.number(),
    changeText: z.string(),
    description: z.string().optional(),
  }),
  metadata: z.object({
    userId: z.string(),
    timestamp: z.string(),
    totalJobs: z.number(),
    currentMonthJobs: z.number(),
    lastMonthJobs: z.number(),
    completedJobs: z.number(),
    successfulJobs: z.number(),
    processedJobs: z.number(),
  }),
});
