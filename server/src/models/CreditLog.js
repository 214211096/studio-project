import mongoose from 'mongoose';

// היסטוריית שינויים ידניים ביתרה של מתאמנת (טעינת כרטיסייה, שיעורי השלמה, עדכון מנוי)
const creditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

export const CreditLog = mongoose.model('CreditLog', creditLogSchema);
