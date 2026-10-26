import mongoose from 'mongoose';
import { HttpError } from '../utils/httpError.js';

// Express 5 מעביר לכאן גם שגיאות מפונקציות async
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: 'מזהה לא תקין' });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: 'נתונים לא תקינים', details: Object.keys(err.errors) });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    const label = { email: 'אימייל', phone: 'טלפון', date: 'תאריך' }[field] || field;
    return res.status(409).json({ message: `${label} כבר קיים במערכת` });
  }
  console.error(err);
  res.status(500).json({ message: 'שגיאת שרת, נסי שוב מאוחר יותר' });
}
