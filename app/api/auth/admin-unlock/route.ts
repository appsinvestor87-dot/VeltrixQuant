import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_STAGE1_COOKIE,
  checkIpLock,
  clearFailedLogins,
  createAdminSessionToken,
  getAdminStage1,
  getClientIp,
  getCookieOptions,
  isHttpsFromHeaders,
  logAdminAudit,
  recordFailedLogin,
} from '@/lib/auth';

const unlockSchema = z.object({
  securityPassword: z.string().min(1, 'Admin security password is required').max(128),
});

export async function POST(req: NextRequest) {
  try {
    const ip = await getClientIp();
    const lock = checkIpLock(ip);
    if (lock.locked) {
      return NextResponse.json(
        {
          error: `IP locked for ${lock.remainingMinutes} minute(s) due to repeated failed attempts.`,
        },
        { status: 429 }
      );
    }

    const stage1 = await getAdminStage1();
    if (!stage1) {
      return NextResponse.json(
        { error: 'Stage 1 authorization expired. Please sign in again.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = unlockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Security password is required.' },
        { status: 400 }
      );
    }

    const adminRow = getDb()
      .prepare(
        'SELECT id, role, display_name, pass2_hash, token_version, is_active FROM admin_accounts WHERE id = ?'
      )
      .get(stage1.adminId) as
      | {
          id: number;
          role: 'MASTER_ADMIN';
          display_name: string;
          pass2_hash: string;
          token_version: number;
          is_active: number;
        }
      | undefined;

    if (
      !adminRow ||
      adminRow.is_active !== 1 ||
      adminRow.token_version !== (stage1.tokenVersion ?? 1) ||
      !bcrypt.compareSync(parsed.data.securityPassword, adminRow.pass2_hash)
    ) {
      const fail = recordFailedLogin(ip, 'Failed Stage-2 admin unlock');
      return NextResponse.json(
        {
          error: fail.locked
            ? 'IP locked for 30 minutes after 5 failed security password attempts.'
            : `Invalid admin security password. ${fail.attemptsLeft} attempt(s) remaining.`,
        },
        { status: 401 }
      );
    }

    clearFailedLogins(ip);
    const adminToken = createAdminSessionToken(
      adminRow.id,
      adminRow.role,
      adminRow.display_name,
      adminRow.token_version
    );

    logAdminAudit({
      admin: { adminId: adminRow.id, displayName: adminRow.display_name, role: adminRow.role },
      action: 'ADMIN_UNLOCK',
      targetType: 'SESSION',
      targetId: adminRow.id,
      details: { stage: 'STAGE_2_VERIFIED' },
      ipAddress: ip,
    });

    const isHttps = isHttpsFromHeaders(req.headers);
    const res = NextResponse.json({
      ok: true,
      role: adminRow.role,
      displayName: adminRow.display_name,
    });
    res.cookies.set(ADMIN_SESSION_COOKIE, adminToken, getCookieOptions(12 * 60 * 60, isHttps));
    res.cookies.set(ADMIN_STAGE1_COOKIE, '', getCookieOptions(0, isHttps));
    return res;
  } catch (err) {
    console.error('Admin unlock error:', err);
    return NextResponse.json({ error: 'Unable to verify admin security password.' }, { status: 500 });
  }
}
