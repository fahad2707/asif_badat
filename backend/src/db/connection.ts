import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/express_distributors';

const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 0,
  retryReads: true,
  retryWrites: true,
};

async function connectWithRetry(retries = 5): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(MONGODB_URI, CONNECT_OPTIONS);
      console.log('✅ MongoDB connected successfully');
      return;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${i + 1}/${retries} failed:`, (error as Error).message);
      if (i < retries - 1) {
        const delay = 3000 * (i + 1);
        console.log(`🔄 Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
      }
    }
  }
}

const connectDB = async () => connectWithRetry();

let reconnecting = false;
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
  if (!reconnecting) {
    reconnecting = true;
    setTimeout(async () => {
      try {
        console.log('🔄 Attempting MongoDB reconnection…');
        await mongoose.connect(MONGODB_URI, CONNECT_OPTIONS);
        console.log('✅ MongoDB reconnected successfully');
      } catch (err) {
        console.error('❌ MongoDB reconnection failed:', err);
      } finally {
        reconnecting = false;
      }
    }, 3000);
  }
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

export default connectDB;
