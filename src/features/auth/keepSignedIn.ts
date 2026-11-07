/**
 * "Keep me signed in on this computer". Without the tick, the sign-in ends with the browser: a cookie
 * with no expiry lasts until then and is shared by every tab. With the tick, nothing ends it.
 */
const KEEP_KEY = 'westock-admin-keep-signed-in-v1';
const COOKIE = 'westock_admin_browser_session';

function readKeep(): string | null {
  try {
    return localStorage.getItem(KEEP_KEY);
  } catch {
    return null;
  }
}

export function rememberSignIn(keep: boolean): void {
  try {
    localStorage.setItem(KEEP_KEY, keep ? '1' : '0');
  } catch {
    // Storage is blocked: the sign-in simply lasts as long as the adapter keeps it.
  }
  document.cookie = `${COOKIE}=1; path=/; SameSite=Lax`;
}

export function forgetSignIn(): void {
  try {
    localStorage.removeItem(KEEP_KEY);
  } catch {
    // Nothing to forget.
  }
  document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/** True when the last sign-in asked not to be kept and the browser has been closed since. */
export function browserSessionEnded(): boolean {
  return readKeep() === '0' && !document.cookie.split('; ').some((c) => c.startsWith(`${COOKIE}=`));
}
