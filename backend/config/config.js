import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env file from the backend folder
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET || 'remember_jwt_super_secret_key_2026_xyz987',
  APP_WEB_URL: process.env.APP_WEB_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'),
  EMAIL_SENDER: {
    NAME: process.env.EMAIL_SENDER_NAME || 'ReMember Membership Concierge',
    ADDRESS: process.env.EMAIL_SENDER_ADDRESS || 'notifications@remember-club.io',
  }
};
