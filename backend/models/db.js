import mongoose from 'mongoose';

export const dbManager = {
  get isConnected() {
    return mongoose.connection.readyState === 1;
  },

  async init(uri) {
    if (!uri) {
      throw new Error('MONGODB_URI is required to start the backend.');
    }

    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
    } catch {
      throw new Error('Could not connect to MongoDB. Backend startup aborted.');
    }

    console.log(`[Database] Connected to MongoDB database ${mongoose.connection.name}.`);
  },
};
