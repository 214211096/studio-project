import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { config } from './config.js';

let memoryServer = null;

export async function connectDB() {
  let uri = config.mongoUri;

  if (!uri) {
    // פיתוח בלי התקנת MongoDB: שרת מקומי שהנתונים שלו נשמרים בתיקייה .data/db
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = path.resolve('.data/db');
    fs.mkdirSync(dbPath, { recursive: true });
    memoryServer = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: 'wiredTiger', port: 27018 },
    });
    uri = memoryServer.getUri('studio');
    console.log(`[db] local MongoDB running at ${uri} (data in ${dbPath})`);
  }

  await mongoose.connect(uri);
  // מעדכן אינדקסים שהשתנו בסכמות
  await mongoose.syncIndexes();
  console.log('[db] connected');
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop({ doCleanup: false });
}
