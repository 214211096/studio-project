// מאפס את המסד וממלא נתוני דוגמה. להריץ כשהשרת כבוי: npm run seed
import { connectDB, disconnectDB } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';

await connectDB();
await seedDatabase();
await disconnectDB();
