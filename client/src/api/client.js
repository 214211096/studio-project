export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// כל הקריאות לשרת עוברות כאן. ההתחברות נשמרת בעוגייה (httpOnly) שהדפדפן שולח לבד.
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('אין חיבור לשרת. בדקי את החיבור לאינטרנט ונסי שוב.', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message || 'אירעה שגיאה', res.status);
  }
  return data;
}
