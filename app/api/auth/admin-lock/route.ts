import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_STAGE1_COOKIE,
  createAdminStage1Token,
  getAuthenticatedAdmin,
  getClientIp,
  getCookieOptions,
  isHttpsFromHeaders,
  logAdminAudit,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  const isHttps = isHttpsFromHeaders(req.headers);
  const { admin } = await getAuthenticatedAdmin();
  const body = (await req.json().catch(() => ({}))) as { fullLogout?: boolean };
  const ip = await getClientIp();

  const res = NextResponse.json({ ok: true, locked: !body.fullLogout });
  res.cookies.set(ADMIN_SESSION_COOKIE, '', getCookieOptions(0, isHttps));

  if (admin) {
    logAdminAudit({
      admin: { adminId: admin.adminId, displayName: admin.displayName, role: admin.role },
      action: body.fullLogout ? 'ADMIN_LOGOUT' : 'ADMIN_LOCK_SCREEN',
      targetType: 'SESSION',
      targetId: admin.adminId,
      ipAddress: ip,
    });

    if (!body.fullLogout) {
      const stage1 = createAdminStage1Token(admin.adminId, admin.role, admin.displayName);
      res.cookies.set(ADMIN_STAGE1_COOKIE, stage1, getCookieOptions(600, isHttps));
    } else {
      res.cookies.set(ADMIN_STAGE1_COOKIE, '', getCookieOptions(0, isHttps));
    }
  } else {
    res.cookies.set(ADMIN_STAGE1_COOKIE, '', getCookieOptions(0, isHttps));
  }

  return res;
}
