import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['none', 'punch_card', 'monthly'], default: 'none' },
    // כרטיסייה
    punchesRemaining: { type: Number, default: 0, min: 0 },
    // מנוי חודשי: מכסה לחודש קלנדרי + שיעורי השלמה שנצברו
    monthlyQuota: { type: Number, default: 0, min: 0 },
    makeupCredits: { type: Number, default: 0, min: 0 },
    // תאריך תפוגה אופציונלי (YYYY-MM-DD). ריק = ללא הגבלת זמן
    expiresOn: { type: String, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
    active: { type: Boolean, default: true },
    healthDeclarationSignedAt: { type: Date, default: null },
    membership: { type: membershipSchema, default: () => ({}) },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email || null,
    phone: this.phone || null,
    role: this.role,
    active: this.active,
    healthDeclarationSignedAt: this.healthDeclarationSignedAt,
    membership: this.membership,
    notes: this.notes,
  };
};

export const User = mongoose.model('User', userSchema);
