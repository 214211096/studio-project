import { config } from '../config.js';
import { ClassSession } from '../models/ClassSession.js';
import { hoursUntil } from '../utils/time.js';
import { notFound } from '../utils/httpError.js';

// "חני כהן לוי" -> "חני ל." (פרטיות: מתאמנות לא רואות שמות מלאים של אחרות)
export function maskName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  return `${parts[0]} ${parts.at(-1)[0]}.`;
}

const idOf = (ref) => (ref && ref._id ? ref._id : ref);

export function sessionSummary(session, viewerId) {
  const waitlistIndex = session.waitlist.findIndex((w) => idOf(w.user).equals(viewerId));
  const isBooked = session.participants.some((p) => idOf(p.user).equals(viewerId));
  return {
    id: session._id.toString(),
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    startAt: session.startAt,
    type: session.type,
    title: session.title,
    instructor: session.instructor,
    capacity: session.capacity,
    status: session.status,
    cancelReason: session.cancelReason,
    cancelledByHoliday: session.cancelledByHoliday,
    isOneOff: !session.template,
    customized: session.customized,
    participantsCount: session.participants.length,
    waitlistCount: session.waitlist.length,
    myStatus: isBooked ? 'booked' : waitlistIndex >= 0 ? 'waitlist' : null,
    myWaitlistPosition: waitlistIndex >= 0 ? waitlistIndex + 1 : null,
  };
}

export async function sessionDetails(sessionId, viewer) {
  const session = await ClassSession.findById(sessionId)
    .populate('participants.user', 'name phone')
    .populate('waitlist.user', 'name phone');
  if (!session) throw notFound('השיעור לא נמצא');

  const isAdmin = viewer.role === 'admin';
  const person = (ref) => {
    if (!ref) return { id: null, name: 'משתמשת שנמחקה', isMe: false };
    const isMe = ref._id.equals(viewer._id);
    return isAdmin
      ? { id: ref._id.toString(), name: ref.name, phone: ref.phone || null, isMe }
      : { name: isMe ? ref.name : maskName(ref.name), isMe };
  };

  const summary = sessionSummary(session, viewer._id);
  const cancelDeadline = new Date(session.startAt.getTime() - config.cancelWindowHours * 36e5);

  return {
    ...summary,
    participants: session.participants.map((p) => ({
      ...person(p.user),
      ...(isAdmin ? { attendance: p.attendance, chargedWith: p.chargedWith } : {}),
    })),
    waitlist: session.waitlist.map((w) => person(w.user)),
    cancelDeadline,
    canCancel:
      summary.myStatus === 'booked' &&
      session.status === 'scheduled' &&
      hoursUntil(session.startAt) >= config.cancelWindowHours,
    cancelWindowHours: config.cancelWindowHours,
  };
}
