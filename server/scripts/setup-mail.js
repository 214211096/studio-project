// הגדרת שליחת מיילים בפקודה אחת: npm run setup-mail
// שואל את פרטי ספק המייל (Brevo או Gmail), שולח מייל בדיקה, ורק אם הצליח - שומר ב-.env.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import nodemailer from 'nodemailer';

const ENV_PATH = new URL('../.env', import.meta.url);

const env = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
const current = (key) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.replace(/^"|"$/g, '').trim() || '';

function setVar(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, fallback = '') => (await rl.question(fallback ? `${q} [${fallback}]: ` : `${q}: `)).trim() || fallback;

console.log('\n=== Mail setup ===');
console.log('  1) Brevo  (no 2-step verification needed)');
console.log('  2) Gmail  (needs 2-step verification + app password)');
const choice = await ask('Choose 1 or 2', '1');

let host, port, user, pass, sender;
if (choice === '2') {
  host = 'smtp.gmail.com';
  port = 465;
  console.log('\nOpen https://myaccount.google.com/apppasswords , create one named "studio", copy the 16 letters.');
  user = await ask('Gmail address', current('SMTP_USER'));
  pass = (await ask('App password (16 letters)')).replace(/\s/g, '');
  sender = user;
} else {
  host = 'smtp-relay.brevo.com';
  port = 587;
  console.log('\nIn Brevo: top-right menu -> "SMTP & API" -> "SMTP" tab.');
  user = await ask('SMTP Login (looks like 9a1b2c001@smtp-brevo.com)');
  pass = await ask('SMTP key (click "Generate a new SMTP key", copy it)');
  sender = await ask('Sender email (the one you verified in Brevo)', 'chani11275@gmail.com');
}
const to = await ask('Send the test email to', sender);
rl.close();

if (!user || !pass || !sender) {
  console.error('\nMissing details. Nothing was saved.');
  process.exit(1);
}

console.log('\nConnecting and sending a test email...');
const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
try {
  await transport.verify();
  await transport.sendMail({
    from: `"Studio" <${sender}>`,
    to,
    subject: 'מייל בדיקה מהסטודיו',
    text: 'אם קיבלת את המייל הזה – שליחת קודי האימות עובדת.',
  });
} catch (err) {
  console.error(`\nSending failed: ${err.message}`);
  console.error('Check the login and key were copied fully. Nothing was saved.');
  process.exit(1);
}

let next = env;
next = setVar(next, 'MAIL_PROVIDER', 'smtp');
next = setVar(next, 'SMTP_HOST', host);
next = setVar(next, 'SMTP_PORT', port);
next = setVar(next, 'SMTP_USER', user);
next = setVar(next, 'SMTP_PASS', pass);
next = setVar(next, 'MAIL_FROM', `"סטודיו פילאטיס <${sender}>"`);
writeFileSync(ENV_PATH, next);

console.log(`\nSUCCESS! A test email was sent to ${to} (check spam too).`);
console.log('Settings saved to server/.env. Restart the server to start sending real emails.');
