import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_STAGE1_COOKIE,
  USER_COOKIE_NAME,
  checkIpLock,
  clearFailedLogins,
  createAdminStage1Token,
  createUserCookieToken,
  getClientIp,
  getCookieOptions,
  isHttpsFromHeaders,
  recordFailedLogin,
} from '@/lib/auth';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required').max(120),
  password: z.string().min(1, 'Password is required').max(128),
});

export async function POST(req: NextRequest) {
  try {
    const ip = await getClientIp();
    const lock = checkIpLock(ip);
    if (lock.locked) {
      return NextResponse.json(
        {
          error: `Too many failed attempts. Your IP is temporarily locked for ${lock.remainingMinutes} minute(s).`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid credentials.' },
        { status: 400 }
      );
    }

    const identifier = parsed.data.identifier.trim();
    const password = parsed.data.password;
    const db = getDb();

    const isHttps = isHttpsFromHeaders(req.headers);

    // Server-side hidden admin trigger check (never exposed in client bundle)
    if (identifier.startsWith('#')) {
      const adminRow = db
        .prepare(
          'SELECT id, role, display_name, pass1_hash, token_version, is_active FROM admin_accounts WHERE LOWER(trigger_id) = LOWER(?)'
        )
        .get(identifier) as
        | {
            id: number;
            role: 'MASTER_ADMIN';
            display_name: string;
            pass1_hash: string;
            token_version: number;
            is_active: number;
          }
        | undefined;

      if (!adminRow || adminRow.is_active !== 1 || !bcrypt.compareSync(password, adminRow.pass1_hash)) {
        const fail = recordFailedLogin(ip, 'Invalid credentials');
        return NextResponse.json(
          {
            error: fail.locked
              ? 'IP temporarily locked for 30 minutes after 5 failed attempts.'
              : `Invalid username or password. ${fail.attemptsLeft} attempt(s) remaining.`,
          },
          { status: 401 }
        );
      }

      clearFailedLogins(ip);
      const stage1Token = createAdminStage1Token(
        adminRow.id,
        adminRow.role,
        adminRow.display_name,
        adminRow.token_version
      );
      const res = NextResponse.json({
        ok: true,
        stage: 'ADMIN_STAGE_2',
        displayName: adminRow.display_name,
      });
      res.cookies.set(USER_COOKIE_NAME, '', getCookieOptions(0, isHttps));
      res.cookies.set(ADMIN_SESSION_COOKIE, '', getCookieOptions(0, isHttps));
      res.cookies.set(ADMIN_STAGE1_COOKIE, stage1Token, getCookieOptions(600, isHttps));
      return res;
    }

    // Normal User Login (by username OR email)
    const userRow = db
      .prepare(
        `SELECT id, uid, username, full_name, email, password_hash, status, block_reason, token_version
         FROM users WHERE username = ? OR email = ?`
      )
      .get(identifier, identifier) as
      | {
          id: number;
          uid: string;
          username: string;
          full_name: string;
          email: string;
          password_hash: string;
          status: string;
          block_reason: string | null;
          token_version: number;
        }
      | undefined;

    if (!userRow || !bcrypt.compareSync(password, userRow.password_hash)) {
      const fail = recordFailedLogin(ip, 'Invalid user login');
      return NextResponse.json(
        {
          error: fail.locked
            ? 'IP temporarily locked for 30 minutes after 5 failed attempts.'
            : `Invalid username/email or password. ${fail.attemptsLeft} attempt(s) remaining.`,
        },
        { status: 401 }
      );
    }

    if (userRow.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: `Account suspended${userRow.block_reason ? `: ${userRow.block_reason}` : '.'}`,
        },
        { status: 403 }
      );
    }

    clearFailedLogins(ip);
    db.prepare('UPDATE users SET last_login_ip = ? WHERE id = ?').run(ip, userRow.id);

    const token = createUserCookieToken(userRow.id, userRow.token_version);
    const res = NextResponse.json({
      ok: true,
      stage: 'USER_AUTHENTICATED',
      user: {
        uid: userRow.uid,
        username: userRow.username,
        fullName: userRow.full_name,
      },
    });
    res.cookies.set(ADMIN_SESSION_COOKIE, '', getCookieOptions(0, isHttps));
    res.cookies.set(ADMIN_STAGE1_COOKIE, '', getCookieOptions(0, isHttps));
    res.cookies.set(USER_COOKIE_NAME, token, getCookieOptions(7 * 24 * 60 * 60, isHttps));
    return res;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Authentication service error.' }, { status: 500 });
  }
}
