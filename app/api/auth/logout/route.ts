import { NextRequest, NextResponse } from 'next/server';
import { USER_COOKIE_NAME, getCookieOptions, isHttpsFromHeaders } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const isHttps = isHttpsFromHeaders(req.headers);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_COOKIE_NAME, '', getCookieOptions(0, isHttps));
  return res;
}
