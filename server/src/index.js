import { config } from './config.js';
import { connectDB, disconnectDB } from './db.js';
import { createApp } from './app.js';
import { User } from './models/User.js';
import { seedDatabase } from './seed.js';
import { verifyMailer } from './services/mailer.js';

await connectDB();
await verifyMailer();

// הרצה ראשונה בפיתוח: ממלאים את המסד בנתוני דוגמה
if (!config.isProd && (await User.estimatedDocumentCount()) === 0) {
  await seedDatabase();
}

const server = createApp().listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
});

async function shutdown() {
  server.close();
  await disconnectDB();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
