import dotenv from 'dotenv';
dotenv.config();

const required = ['MONGO_URI', 'WHATSAPP_AGENT_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI,
  whatsapp: {
    base: process.env.WHATSAPP_API_BASE || 'https://api.whatsapp.com/agent/v1',
    key: process.env.WHATSAPP_AGENT_KEY,
  },
  timezone: process.env.DEFAULT_TIMEZONE || 'Asia/Karachi',
  logLevel: process.env.LOG_LEVEL || 'dev',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
};