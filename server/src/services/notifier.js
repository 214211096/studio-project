import { Notification } from '../models/Notification.js';

// כרגע התראות נשמרות במערכת (פעמון באתר) ונכתבות ללוג.
// כאן המקום לחבר בעתיד שליחת מייל / SMS / WhatsApp.
export async function notify(userId, text) {
  await Notification.create({ user: userId, text });
  console.log(`[notify] ${userId}: ${text}`);
}

export async function notifyMany(userIds, text) {
  if (userIds.length === 0) return;
  await Notification.insertMany(userIds.map((user) => ({ user, text })));
  console.log(`[notify] ${userIds.length} users: ${text}`);
}
