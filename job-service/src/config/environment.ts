import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

interface Config {
  NODE_ENV: string;
  STAGE: string;
  PORT: number;
  JWT_SECRET: string;
  JWT_EXPIRE_IN: string;
  API_VERSION: string;
  LOG_LEVEL: string;
  AWS_S3_BUCKET: string;
  AWS_SQS_QUEUE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  QUEUE_NAME: string;
  CHARGEBEE_SITE: string;
  CHARGEBEE_API_KEY: string;
}

const stageFromEnv = (process.env.STAGE || process.env.NODE_ENV || "dev").toLowerCase();
const STAGE = stageFromEnv === "development" ? "dev" : stageFromEnv;

const config: Config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  STAGE,
  PORT: parseInt(process.env.PORT || "3000", 10),
  JWT_SECRET: process.env.JWT_SECRET || "fallback-secret-change-in-production",
  JWT_EXPIRE_IN: process.env.JWT_EXPIRE_IN || "7d",
  API_VERSION: process.env.API_VERSION || "v1",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || "parser-service-uploads",
  AWS_SQS_QUEUE_URL: process.env.AWS_SQS_QUEUE_URL || "https://sqs.us-east-1.amazonaws.com/your-account-id/your-queue-name",
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  QUEUE_NAME: process.env.QUEUE_NAME || "",
  CHARGEBEE_SITE: process.env.CHARGEBEE_SITE || "",
  CHARGEBEE_API_KEY: process.env.CHARGEBEE_API_KEY || "",
};


// Validate required environment variables in production
if (config.NODE_ENV === "production") {
  const requiredEnvVars = ["JWT_SECRET"];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}

export default config;
