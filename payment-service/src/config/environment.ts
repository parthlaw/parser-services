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
  JWT_ALGORITHM: string;
  AWS_REGION: string;
  API_VERSION: string;
  CORS_ORIGIN: string;
  LOG_LEVEL: string;
  DYNAMO_ENDPOINT: string;
  USERS_TABLE: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  // PayPal Configuration
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_BASE_URL: string;
  PAYPAL_WEBHOOK_ID: string;
  // Razorpay Configuration
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_BASE_URL: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
}

const stageFromEnv = (process.env.STAGE || process.env.NODE_ENV || "dev").toLowerCase();
const STAGE = stageFromEnv === "development" ? "dev" : stageFromEnv;

const config: Config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  STAGE,
  PORT: parseInt(process.env.PORT || "3000", 10),
  JWT_SECRET: process.env.JWT_SECRET || "fallback-secret-change-in-production",
  JWT_ALGORITHM: process.env.JWT_ALGORITHM || "HS256",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "dummy",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "dummy",
  JWT_EXPIRE_IN: process.env.JWT_EXPIRE_IN || "7d",
  AWS_REGION: process.env.AWS_REGION || "us-east-1",
  API_VERSION: process.env.API_VERSION || "v1",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  DYNAMO_ENDPOINT: process.env.DYNAMO_ENDPOINT || "",
  USERS_TABLE: process.env.USERS_TABLE || `${STAGE}-users`,
  // PayPal Configuration
  PAYPAL_CLIENT_ID: (STAGE === "prod" ? process.env.PAYPAL_CLIENT_ID : process.env.PAYPAL_CLIENT_ID_SANDBOX) || "",
  PAYPAL_CLIENT_SECRET: (STAGE === "prod" ? process.env.PAYPAL_CLIENT_SECRET : process.env.PAYPAL_CLIENT_SECRET_SANDBOX) || "",
  PAYPAL_BASE_URL: (STAGE === "prod" ? process.env.PAYPAL_BASE_URL : process.env.PAYPAL_BASE_URL_SANDBOX) || (STAGE === "prod" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"),
  PAYPAL_WEBHOOK_ID: (STAGE === "prod" ? process.env.PAYPAL_WEBHOOK_ID : process.env.PAYPAL_WEBHOOK_ID_SANDBOX) || "",
  // Razorpay Configuration
  RAZORPAY_KEY_ID: (STAGE === "prod" ? process.env.RAZORPAY_KEY_ID : process.env.RAZORPAY_KEY_ID_SANDBOX) || "",
  RAZORPAY_KEY_SECRET: (STAGE === "prod" ? process.env.RAZORPAY_KEY_SECRET : process.env.RAZORPAY_KEY_SECRET_SANDBOX) || "",
  RAZORPAY_BASE_URL: (STAGE === "prod" ? process.env.RAZORPAY_BASE_URL : process.env.RAZORPAY_BASE_URL_SANDBOX) || "https://api.razorpay.com",
  RAZORPAY_WEBHOOK_SECRET: (STAGE === "prod" ? process.env.RAZORPAY_WEBHOOK_SECRET : process.env.RAZORPAY_WEBHOOK_SECRET_SANDBOX) || "",
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_KEY: process.env.SUPABASE_KEY || "",
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
