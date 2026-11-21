import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { getDb, getSettingsMap } from './db';

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'veltrix-quant-dev-fallback-secret-change-in-prod-2026';

export const USER_COOKIE_NAME = 'vq_user_session';
export const ADMIN_STAGE1_COOKIE = 'vq_adm_s1';
export const ADMIN_SESSION_COOKIE = 'vq_adm_session';

const MAX_FAILED_ATTEMPTS = 5;
const IP_LOCK_DURATION_MS = 30 * 60 * 1000;

export interface UserTokenPayload {
  kind: 'USER';
  userId: number;
  tokenVersion: number;
  exp: number;
}

export interface AdminStage1Payload {
  kind: 'ADMIN_STAGE_1';
  adminId: number;
  role: 'MASTER_ADMIN';
  displayName: string;
  tokenVersion: number;
  exp: number;
}

export interface AdminSessionPayload {
  kind: 'ADMIN_UNLOCKED';
  adminId: number;
  role: 'MASTER_ADMIN';
  displayName: string;
  tokenVersion: number;
  lastActiveAt: number;
  exp: number;
}

function signPayload(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken<T extends { exp: number }>(token: string | undefined): T | null {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as T;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  const forwarded = hdrs.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return hdrs.get('x-real-ip') || '127.0.0.1';
}

export function checkIpLock(ip: string): { locked: boolean; remainingMinutes: number } {
  const db = getDb();
  const row = db
    .prepare('SELECT failed_attempts, locked_until FROM ip_locks WHERE ip = ?')
    .get(ip) as { failed_attempts: number; locked_until: number | null } | undefined;

  if (!row || !row.locked_until) return { locked: false, remainingMinutes: 0 };
  const now = Date.now();
  if (now < row.locked_until) {
    return {
      locked: true,
      remainingMinutes: Math.ceil((row.locked_until - now) / 60000),
    };
  }
  db.prepare('DELETE FROM ip_locks WHERE ip = ?').run(ip);
  return { locked: false, remainingMinutes: 0 };
}

export function recordFailedLogin(ip: string, reason: string): {
  locked: boolean;
  attemptsLeft: number;
} {
  const db = getDb();
  const now = Date.now();
  const existing = db
    .prepare('SELECT failed_attempts FROM ip_locks WHERE ip = ?')
    .get(ip) as { failed_attempts: number } | undefined;
  const nextCount = (existing?.failed_attempts || 0) + 1;
  const shouldLock = nextCount >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = shouldLock ? now + IP_LOCK_DURATION_MS : null;

  db.prepare(
    `INSERT INTO ip_locks (ip, failed_attempts, locked_until, last_attempt_at, reason)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(ip) DO UPDATE SET
       failed_attempts = excluded.failed_attempts,
       locked_until = excluded.locked_until,
       last_attempt_at = excluded.last_attempt_at,
       reason = excluded.reason`
  ).run(ip, nextCount, lockedUntil, now, reason);

  return {
    locked: shouldLock,
    attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - nextCount),
  };
}

export function clearFailedLogins(ip: string) {
  getDb().prepare('DELETE FROM ip_locks WHERE ip = ?').run(ip);
}

export function createUserCookieToken(userId: number, tokenVersion: number): string {
  return signPayload({
    kind: 'USER',
    userId,
    tokenVersion,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  } satisfies UserTokenPayload);
}

export function createAdminStage1Token(
  adminId: number,
  role: 'MASTER_ADMIN',
  displayName: string,
  tokenVersion = 1
): string {
  return signPayload({
    kind: 'ADMIN_STAGE_1',
    adminId,
    role,
    displayName,
    tokenVersion,
    exp: Date.now() + 10 * 60 * 1000, // 10 min to enter password #2
  } satisfies AdminStage1Payload);
}

export function createAdminSessionToken(
  adminId: number,
  role: 'MASTER_ADMIN',
  displayName: string,
  tokenVersion = 1
): string {
  const now = Date.now();
  return signPayload({
    kind: 'ADMIN_UNLOCKED',
    adminId,
    role,
    displayName,
    tokenVersion,
    lastActiveAt: now,
    exp: now + 12 * 60 * 60 * 1000,
  } satisfies AdminSessionPayload);
}

export function isHttpsFromHeaders(hdrs: Pick<Headers, 'get'>): boolean {
  const fwdProto = (hdrs.get('x-forwarded-proto') || '').split(',')[0]?.trim().toLowerCase();
  if (fwdProto === 'https') return true;
  if (hdrs.get('x-forwarded-ssl')?.toLowerCase() === 'on') return true;
  const origin = hdrs.get('origin') || '';
  if (origin.startsWith('https://')) return true;
  const referer = hdrs.get('referer') || '';
  if (referer.startsWith('https://')) return true;
  return false;
}

export function getCookieOptions(maxAgeSeconds: number, isHttps = false) {
  return {
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  const payload = verifyToken<UserTokenPayload>(token);
  if (!payload || payload.kind !== 'USER') return null;

  const user = getDb()
    .prepare(
      `SELECT id, uid, username, full_name, email, referral_code, referred_by_id,
              bep20_address, bep20_locked, withdraw_pin_hash,
              capital_balance, profit_balance, locked_profit_balance,
              total_deposited, total_withdrawn, total_earned,
              first_deposit_at, status, block_reason, token_version, last_login_ip, created_at
       FROM users WHERE id = ?`
    )
    .get(payload.userId) as
    | {
        id: number;
        uid: string;
        username: string;
        full_name: string;
        email: string;
        referral_code: string;
        referred_by_id: number | null;
        bep20_address: string | null;
        bep20_locked: number;
        withdraw_pin_hash: string | null;
        capital_balance: number;
        profit_balance: number;
        locked_profit_balance: number;
        total_deposited: number;
        total_withdrawn: number;
        total_earned: number;
        first_deposit_at: number | null;
        status: string;
        block_reason: string | null;
        token_version: number;
        last_login_ip: string | null;
        created_at: number;
      }
    | undefined;

  if (!user || user.status !== 'ACTIVE' || user.token_version !== payload.tokenVersion) {
    return null;
  }
  return user;
}

export async function getAdminStage1() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_STAGE1_COOKIE)?.value;
  const payload = verifyToken<AdminStage1Payload>(token);
  if (!payload || payload.kind !== 'ADMIN_STAGE_1') return null;
  return payload;
}

export async function getAuthenticatedAdmin(): Promise<{
  admin: AdminSessionPayload | null;
  idleLocked: boolean;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const payload = verifyToken<AdminSessionPayload>(token);
  if (!payload || payload.kind !== 'ADMIN_UNLOCKED') {
    return { admin: null, idleLocked: false };
  }

  const settings = getSettingsMap();
  const idleMinutes = Math.max(5, Number(settings.admin_idle_lock_minutes || '120'));
  const idleMs = idleMinutes * 60 * 1000;
  if (Date.now() - payload.lastActiveAt > idleMs) {
    return { admin: null, idleLocked: true };
  }

  const account = getDb()
    .prepare('SELECT id, is_active, token_version FROM admin_accounts WHERE id = ?')
    .get(payload.adminId) as { id: number; is_active: number; token_version: number } | undefined;
  if (
    !account ||
    account.is_active !== 1 ||
    account.token_version !== (payload.tokenVersion ?? 1)
  ) {
    return { admin: null, idleLocked: false };
  }

  return { admin: payload, idleLocked: false };
}

export function logAdminAudit(params: {
  admin: { adminId: number; displayName: string; role: string };
  action: string;
  targetType: string;
  targetId?: string | number | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO admin_audit_logs
       (admin_id, admin_name, admin_role, action, target_type, target_id, details_json, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.admin.adminId,
      params.admin.displayName,
      params.admin.role,
      params.action,
      params.targetType,
      params.targetId != null ? String(params.targetId) : null,
      params.details ? JSON.stringify(params.details) : null,
      params.ipAddress || '127.0.0.1',
      Date.now()
    );
}
