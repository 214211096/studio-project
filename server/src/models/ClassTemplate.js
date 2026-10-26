import mongoose from 'mongoose';

// שיעור קבוע במערכת השבועית. ממנו נוצרים מופעי ClassSession לכל תאריך.
const classTemplateSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    type: { type: String, enum: ['pilates', 'spinning'], required: true },
    title: { type: String, required: true, trim: true },
    instructor: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ClassTemplate = mongoose.model('ClassTemplate', classTemplateSchema);
