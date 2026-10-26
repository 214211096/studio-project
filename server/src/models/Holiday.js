import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const Holiday = mongoose.model('Holiday', holidaySchema);
