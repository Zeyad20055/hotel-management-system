import mongoose from 'mongoose';
import env from './env.js';

export const dbInfo = { mode: 'disconnected', uri: null };
let memoryServer = null;

const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
export const dbState = () => stateNames[mongoose.connection.readyState] || 'unknown';

export async function connectDB() {
  let uri = env.mongoUri;
  if (uri) {
    dbInfo.mode = 'external';
  } else {
    let MongoMemoryServer;
    try {
      ({ MongoMemoryServer } = await import('mongodb-memory-server'));
    } catch {
      throw new Error('MONGODB_URI is not set and mongodb-memory-server is not installed. Set MONGODB_URI in .env (e.g. mongodb://127.0.0.1:27017/hotel_management) or run npm install.');
    }
    try {
      memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'hotel' } });
    } catch (e) {
      throw new Error(`Could not start the temporary in-memory MongoDB (${e.message}). It downloads a MongoDB binary on first use: allow internet access, or install MongoDB and set MONGODB_URI in .env.`);
    }
    uri = memoryServer.getUri();
    dbInfo.mode = 'memory';
    console.warn('\n[db] DEVELOPMENT MODE: using a TEMPORARY in-memory MongoDB. All data disappears when the server stops.\n[db] Set MONGODB_URI in .env for persistent storage.\n');
  }
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  } catch (e) {
    throw new Error(`Cannot connect to MongoDB (${e.message}). Make sure MongoDB is running and MONGODB_URI is correct, or clear MONGODB_URI in development to use the temporary in-memory database.`);
  }
  dbInfo.uri = uri.replace(/\/\/[^@/]*@/, '//***@');
  return dbInfo;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) { await memoryServer.stop(); memoryServer = null; }
  dbInfo.mode = 'disconnected';
}
