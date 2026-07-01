// Shared in-memory session store for authentication
export const sessions = new Set();
export const SESSION_COOKIE_NAME = 'session';

// Parse a raw "Cookie" header into a plain key/value object
export function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}
