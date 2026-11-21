import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getDb, withTransaction } from '@/lib/db';
import {
  USER_COOKIE_NAME,
  createUserCookieToken,
  getClientIp,
  getCookieOptions,
  isHttpsFromHeaders,
} from '@/lib/auth';
import {
  validateEmail,
  validateStrongPassword,
  validateUsername,
} from '@/lib/quant-rules';

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(64),
  username: z.string().trim().min(4).max(24),
  email: z.string().trim().email('Enter a valid email address').max(120),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
  referralCode: z.string().trim().min(4, 'Valid active member referral code is required').max(32),
  acceptedTerms: z
    .boolean()
    .refine((v) => v === true, 'You must accept the Veltrix Quant Terms & Policies.'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid registration details.' },
        { status: 400 }
      );
    }

    const { fullName, username, email, password, confirmPassword, referralCode } = parsed.data;

    const uCheck = validateUsername(username);
    if (!uCheck.valid) {
      return NextResponse.json({ error: uCheck.reason }, { status: 400 });
    }
    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 });
    }
    const pwCheck = validateStrongPassword(password);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.reason }, { status: 400 });
    }

    const db = getDb();

    // Strict active member referral check: sponsor MUST exist, be ACTIVE, and have >= $100 active deposit
    const sponsor = db
      .prepare(
        `SELECT id, status, capital_balance, first_deposit_at
         FROM users WHERE UPPER(referral_code) = UPPER(?)`
      )
      .get(referralCode.trim()) as
      | {
          id: number;
          status: string;
          capital_balance: number;
          first_deposit_at: number | null;
        }
      | undefined;

    if (!sponsor || sponsor.status !== 'ACTIVE' || sponsor.capital_balance < 100 || !sponsor.first_deposit_at) {
      return NextResponse.json(
        {
          error:
            'Invalid referral code. Registration requires a referral code belonging to an active deposited member.',
        },
        { status: 400 }
      );
    }

    const existingUser = db
      .prepare('SELECT id, username, email FROM users WHERE username = ? OR email = ?')
      .get(username, email) as { id: number; username: string; email: string } | undefined;

    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Email is already registered.' }, { status: 409 });
    }

    const ip = await getClientIp();
    const now = Date.now();
    const passHash = bcrypt.hashSync(password, 10);

    const created = withTransaction((tx) => {
      const countRow = tx.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
      const uid = `VQ-${10001 + countRow.cnt}`;
      const newRefCode = `VQ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const info = tx
        .prepare(
          `INSERT INTO users
           (uid, username, full_name, email, password_hash, referral_code, referred_by_id,
            status, token_version, last_login_ip, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)`
        )
        .run(
          uid,
          username.toLowerCase(),
          fullName,
          email.toLowerCase(),
          passHash,
          newRefCode,
          sponsor.id,
          ip,
          now
        );

      return { id: Number(info.lastInsertRowid), uid, username: username.toLowerCase(), fullName };
    });

    const isHttps = isHttpsFromHeaders(req.headers);
    const token = createUserCookieToken(created.id, 1);
    const res = NextResponse.json({ ok: true, user: created }, { status: 201 });
    res.cookies.set(USER_COOKIE_NAME, token, getCookieOptions(7 * 24 * 60 * 60, isHttps));
    return res;
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Unable to complete registration.' }, { status: 500 });
  }
}
