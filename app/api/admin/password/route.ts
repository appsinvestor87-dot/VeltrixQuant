import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  attachRefreshedAdminCookie,
  getAdminHttpsFlag,
  requireAdminGuard,
} from '@/lib/admin-guard';
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getClientIp,
  getCookieOptions,
  logAdminAudit,
} from '@/lib/auth';
import { getDb } from '@/lib/db';
import { validateStrongPassword } from '@/lib/quant-rules';

const changePasswordSchema = z.object({
  currentMasterPass1: z.string().min(1, 'Current Stage-1 login password is required.'),
  currentMasterPass2: z.string().min(1, 'Current Stage-2 security password is required.'),
  newPass1: z.string().optional(),
  newPass2: z.string().optional(),
});

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const row = getDb()
    .prepare(
      'SELECT id, trigger_id, role, display_name, is_active, created_at FROM admin_accounts WHERE id = ?'
    )
    .get(guard.admin.adminId) as
    | {
        id: number;
        trigger_id: string;
        role: string;
        display_name: string;
        is_active: number;
        created_at: number;
      }
    | undefined;

  const account = row
    ? {
        id: row.id,
        triggerId: row.trigger_id,
        role: row.role,
        displayName: row.display_name,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
      }
    : null;

  const res = NextResponse.json({ account });
  return attachRefreshedAdminCookie(res, guard.admin);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid password update payload.' },
        { status: 400 }
      );
    }

    const { currentMasterPass1, currentMasterPass2 } = parsed.data;
    const newPass1 = parsed.data.newPass1?.trim() || '';
    const newPass2 = parsed.data.newPass2?.trim() || '';

    if (!newPass1 && !newPass2) {
      return NextResponse.json(
        { error: 'Enter a new Stage-1 password, a new Stage-2 security password, or both.' },
        { status: 400 }
      );
    }

    if (newPass1) {
      const check1 = validateStrongPassword(newPass1);
      if (!check1.valid) {
        return NextResponse.json(
          { error: `New Stage-1 password: ${check1.reason}` },
          { status: 400 }
        );
      }
    }

    if (newPass2) {
      const check2 = validateStrongPassword(newPass2);
      if (!check2.valid) {
        return NextResponse.json(
          { error: `New Stage-2 security password: ${check2.reason}` },
          { status: 400 }
        );
      }
    }

    const db = getDb();
    const masterAccount = db
      .prepare(
        'SELECT id, pass1_hash, pass2_hash, display_name, token_version, is_active FROM admin_accounts WHERE id = ?'
      )
      .get(guard.admin.adminId) as
      | {
          id: number;
          pass1_hash: string;
          pass2_hash: string;
          display_name: string;
          token_version: number;
          is_active: number;
        }
      | undefined;

    if (
      !masterAccount ||
      masterAccount.is_active !== 1 ||
      !bcrypt.compareSync(currentMasterPass1, masterAccount.pass1_hash) ||
      !bcrypt.compareSync(currentMasterPass2, masterAccount.pass2_hash)
    ) {
      return NextResponse.json(
        { error: 'Current Master Admin Pass #1 or Pass #2 verification failed.' },
        { status: 401 }
      );
    }

    const nextTokenVersion = (masterAccount.token_version || 1) + 1;

    if (newPass1 && newPass2) {
      db.prepare(
        'UPDATE admin_accounts SET pass1_hash = ?, pass2_hash = ?, token_version = ? WHERE id = ?'
      ).run(
        bcrypt.hashSync(newPass1, 10),
        bcrypt.hashSync(newPass2, 10),
        nextTokenVersion,
        masterAccount.id
      );
    } else if (newPass1) {
      db.prepare('UPDATE admin_accounts SET pass1_hash = ?, token_version = ? WHERE id = ?').run(
        bcrypt.hashSync(newPass1, 10),
        nextTokenVersion,
        masterAccount.id
      );
    } else {
      db.prepare('UPDATE admin_accounts SET pass2_hash = ?, token_version = ? WHERE id = ?').run(
        bcrypt.hashSync(newPass2, 10),
        nextTokenVersion,
        masterAccount.id
      );
    }

    logAdminAudit({
      admin: guard.admin,
      action: 'CHANGE_ADMIN_PASSWORD',
      targetType: 'ADMIN_ACCOUNT',
      targetId: masterAccount.id,
      details: {
        targetDisplayName: masterAccount.display_name,
        rotatedPass1: Boolean(newPass1),
        rotatedPass2: Boolean(newPass2),
        tokenVersion: nextTokenVersion,
      },
      ipAddress: await getClientIp(),
    });

    const refreshedToken = createAdminSessionToken(
      guard.admin.adminId,
      guard.admin.role,
      guard.admin.displayName,
      nextTokenVersion
    );

    const res = NextResponse.json({
      ok: true,
      targetDisplayName: masterAccount.display_name,
    });
    res.cookies.set(
      ADMIN_SESSION_COOKIE,
      refreshedToken,
      getCookieOptions(12 * 60 * 60, getAdminHttpsFlag(guard.admin))
    );
    return res;
  } catch (err) {
    console.error('Admin password change error:', err);
    return NextResponse.json({ error: 'Unable to update admin password.' }, { status: 500 });
  }
}
