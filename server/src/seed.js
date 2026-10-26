import bcrypt from 'bcryptjs';
import { User } from './models/User.js';
import { ClassTemplate } from './models/ClassTemplate.js';
import { ClassSession } from './models/ClassSession.js';
import { Holiday } from './models/Holiday.js';
import { Notification } from './models/Notification.js';
import { OtpCode } from './models/OtpCode.js';
import { CreditLog } from './models/CreditLog.js';
import { config } from './config.js';
import { addDays, todayISO, weekStartOf } from './utils/time.js';
import { ensureWeekSessions } from './services/schedule.js';

const INSTRUCTOR = 'רחלי כץ';
const PILATES = { type: 'pilates', title: 'פילאטיס מכשירים' };
const SPINNING = { type: 'spinning', title: 'ספינינג' };

// המערכת השבועית מהאיפיון. 0 = ראשון
const WEEKLY_SCHEDULE = {
  0: [['19:50', '20:40', PILATES], ['20:40', '21:30', PILATES], ['21:30', '22:20', SPINNING]],
  1: [['20:50', '21:40', PILATES], ['21:40', '22:30', PILATES], ['22:30', '23:20', SPINNING]],
  2: [['19:50', '20:40', PILATES], ['20:40', '21:30', PILATES], ['21:30', '22:20', SPINNING]],
  3: [
    ['19:00', '19:50', PILATES], ['19:50', '20:40', PILATES], ['20:40', '21:30', PILATES],
    ['21:30', '22:20', SPINNING],
  ],
  4: [
    ['18:10', '19:00', PILATES], ['19:00', '19:50', PILATES], ['19:50', '20:40', PILATES],
    ['20:40', '21:30', PILATES], ['21:30', '22:20', SPINNING],
  ],
  5: [
    ['07:40', '08:30', PILATES], ['08:30', '09:20', PILATES], ['09:20', '10:10', PILATES],
    ['10:10', '11:00', PILATES], ['11:00', '11:50', PILATES],
  ],
};

const DEMO_PASSWORD = '123456';

const DEMO_MEMBERS = [
  { name: 'חני כהן', email: 'chani@studio.com', phone: '+972501234567',
    membership: { type: 'punch_card', punchesRemaining: 10 } },
  { name: 'דנה לוי', email: 'dana@studio.com', phone: '+972502345678',
    membership: { type: 'monthly', monthlyQuota: 8, makeupCredits: 2 } },
  { name: 'מיכל אברהם', email: 'michal@studio.com', membership: { type: 'punch_card', punchesRemaining: 2 } },
  { name: 'נועה פרץ', email: 'noa@studio.com', membership: { type: 'punch_card', punchesRemaining: 5 } },
  { name: 'שירה ביטון', email: 'shira@studio.com', membership: { type: 'monthly', monthlyQuota: 4 } },
  { name: 'יעל מזרחי', email: 'yael@studio.com', membership: { type: 'punch_card', punchesRemaining: 8 } },
  { name: 'רוני אוחיון', email: 'roni@studio.com', membership: { type: 'punch_card', punchesRemaining: 3 } },
  { name: 'תמר דהן', email: 'tamar@studio.com', membership: { type: 'monthly', monthlyQuota: 8 } },
  { name: 'אורית שלום', email: 'orit@studio.com', membership: { type: 'punch_card', punchesRemaining: 6 } },
];

export async function seedDatabase() {
  if (config.isProd) throw new Error('Refusing to seed a production database');

  await Promise.all(
    [User, ClassTemplate, ClassSession, Holiday, Notification, OtpCode, CreditLog].map((m) => m.deleteMany({}))
  );

  await ClassTemplate.insertMany(
    Object.entries(WEEKLY_SCHEDULE).flatMap(([day, slots]) =>
      slots.map(([startTime, endTime, kind]) => ({
        dayOfWeek: Number(day),
        startTime,
        endTime,
        ...kind,
        instructor: INSTRUCTOR,
        capacity: config.defaultCapacity,
      }))
    )
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await User.create({
    name: INSTRUCTOR,
    email: 'admin@studio.com',
    phone: '+972500000000',
    passwordHash,
    role: 'admin',
    healthDeclarationSignedAt: new Date(),
  });
  const members = await User.insertMany(
    DEMO_MEMBERS.map((m) => ({ ...m, passwordHash, healthDeclarationSignedAt: new Date() }))
  );

  // שיעור מלא בשבוע הבא - כדי שאפשר יהיה לנסות את רשימת ההמתנה
  const nextWeek = addDays(weekStartOf(todayISO()), 7);
  await ensureWeekSessions(nextWeek);
  const fullClass = await ClassSession.findOne({ date: { $gte: nextWeek }, type: 'pilates' }).sort({
    date: 1,
    startTime: 1,
  });
  if (fullClass) {
    // חני ודנה לא ברשימה, כדי שהן יוכלו לנסות להצטרף להמתנה
    const others = members.filter((m) => !['chani@studio.com', 'dana@studio.com'].includes(m.email));
    fullClass.participants = others
      .slice(0, fullClass.capacity)
      .map((u) => ({ user: u._id, chargedWith: 'none' }));
    await fullClass.save();
  }

  console.log(`[seed] done. admin@studio.com / ${DEMO_PASSWORD}, chani@studio.com / ${DEMO_PASSWORD}`);
}
