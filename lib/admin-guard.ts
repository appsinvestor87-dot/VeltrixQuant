import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_STAGE1_COOKIE,
  createAdminSessionToken,
  createAdminStage1Token,
  getAuthenticatedAdmin,
  getCookieOptions,
  isHttpsFromHeaders,
  type AdminSessionPayload,
} from './auth';

const adminHttpsContext = new WeakMap<AdminSessionPayload, boolean>();

export type AdminGuardResult =
  | { ok: true; admin: AdminSessionPayload }
  | { ok: false; response: NextResponse };

export async function requireAdminGuard(): Promise<AdminGuardResult> {
  const hdrs = await headers();
  const isHttps = isHttpsFromHeaders(hdrs);
  const { admin, idleLocked } = await getAuthenticatedAdmin();
  if (idleLocked) {
    const res = NextResponse.json(
      { error: 'Admin session locked after 2 hours of inactivity.', code: 'ADMIN_IDLE_LOCKED' },
      { status: 401 }
    );
    res.cookies.set(ADMIN_SESSION_COOKIE, '', getCookieOptions(0, isHttps));
    return { ok: false, response: res };
  }
  if (!admin) {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  adminHttpsContext.set(admin, isHttps);
  return { ok: true, admin };
}

export function getAdminHttpsFlag(admin: AdminSessionPayload): boolean {
  return adminHttpsContext.get(admin) ?? false;
}

export function attachRefreshedAdminCookie(
  res: NextResponse,
  admin: AdminSessionPayload
): NextResponse {
  const isHttps = adminHttpsContext.get(admin) ?? false;
  const refreshed = createAdminSessionToken(
    admin.adminId,
    admin.role,
    admin.displayName,
    admin.tokenVersion ?? 1
  );
  res.cookies.set(ADMIN_SESSION_COOKIE, refreshed, getCookieOptions(12 * 60 * 60, isHttps));
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

export function lockAdminWithStage1Cookie(
  res: NextResponse,
  admin: AdminSessionPayload
): NextResponse {
  const isHttps = adminHttpsContext.get(admin) ?? false;
  const stage1 = createAdminStage1Token(
    admin.adminId,
    admin.role,
    admin.displayName,
    admin.tokenVersion ?? 1
  );
  res.cookies.set(ADMIN_SESSION_COOKIE, '', getCookieOptions(0, isHttps));
  res.cookies.set(ADMIN_STAGE1_COOKIE, stage1, getCookieOptions(600, isHttps));
  return res;
}
