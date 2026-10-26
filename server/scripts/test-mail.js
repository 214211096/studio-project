// שולח מייל בדיקה כדי לוודא שהגדרות ה-SMTP ב-.env עובדות: npm run test-mail -- you@example.com
import { config } from '../src/config.js';
import { sendMail } from '../src/services/mailer.js';

const to = process.argv[2];
if (!to) {
  console.error('שימוש: npm run test-mail -- כתובת@מייל.com');
  process.exit(1);
}

try {
  await sendMail(to, 'מייל בדיקה מהסטודיו', 'אם קיבלת את המייל הזה – שליחת קודי האימות עובדת.');
  console.log(config.mailProvider === 'console' ? 'MAIL_PROVIDER=console: המייל הודפס למעלה ולא נשלח' : `נשלח בהצלחה אל ${to}`);
} catch (err) {
  console.error('השליחה נכשלה:', err.message);
  process.exit(1);
}
