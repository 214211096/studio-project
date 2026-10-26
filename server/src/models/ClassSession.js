import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // ממה ירד השיעור - כדי להחזיר למקום הנכון בביטול
    chargedWith: { type: String, enum: ['punch', 'monthly', 'makeup', 'none'], required: true },
    attendance: { type: String, enum: ['attended', 'no_show', null], default: null },
    bookedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const waitlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// מופע של שיעור בתאריך מסוים. בלי template = שיעור חד-פעמי שהמנהלת הוסיפה
const classSessionSchema = new mongoose.Schema(
  {
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassTemplate', default: null },
    // נערך ידנית - שינויים במערכת הקבועה לא ידרסו אותו
    customized: { type: Boolean, default: false },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    startAt: { type: Date, required: true },
    type: { type: String, enum: ['pilates', 'spinning'], required: true },
    title: { type: String, required: true },
    instructor: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['scheduled', 'cancelled'], default: 'scheduled' },
    cancelReason: { type: String, default: null },
    cancelledByHoliday: { type: Boolean, default: false },
    participants: { type: [participantSchema], default: [] },
    waitlist: { type: [waitlistSchema], default: [] },
  },
  { timestamps: true }
);

classSessionSchema.index(
  { template: 1, date: 1 },
  { unique: true, partialFilterExpression: { template: { $type: 'objectId' } } }
);
classSessionSchema.index({ date: 1, startTime: 1 });
classSessionSchema.index({ 'participants.user': 1, date: 1 });
classSessionSchema.index({ 'waitlist.user': 1 });

export const ClassSession = mongoose.model('ClassSession', classSessionSchema);
