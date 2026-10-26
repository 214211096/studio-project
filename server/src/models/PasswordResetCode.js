import mongoose from 'mongoose';

const passwordResetCodeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

// MongoDB מוחק אוטומטית קודים שפג תוקפם
passwordResetCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetCode = mongoose.model('PasswordResetCode', passwordResetCodeSchema);
