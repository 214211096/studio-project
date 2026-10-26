export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const unauthorized = (msg = 'נדרשת התחברות') => new HttpError(401, msg);
export const forbidden = (msg = 'אין הרשאה לפעולה זו') => new HttpError(403, msg);
export const notFound = (msg = 'לא נמצא') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);
