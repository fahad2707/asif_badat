import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/express_distributors';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
      retryReads: true,
      retryWrites: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

let reconnecting = false;
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
  if (!reconnecting) {
    reconnecting = true;
    setTimeout(async () => {
      try {
        console.log('🔄 Attempting MongoDB reconnection…');
        await mongoose.connect(MONGODB_URI);
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
