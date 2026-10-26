import bcrypt from 'bcryptjs';
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

// ייצור: יוצרים את המנהלת הראשונה מתוך ADMIN_EMAIL / ADMIN_PASSWORD אם אין עדיין מנהלת
if (config.isProd && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD
  && !(await User.exists({ role: 'admin' }))) {
  await User.create({
    name: process.env.ADMIN_NAME || 'מנהלת',
    email: process.env.ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10),
    role: 'admin',
  });
  console.log(`[setup] admin created: ${process.env.ADMIN_EMAIL}`);
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
