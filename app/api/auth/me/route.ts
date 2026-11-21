import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { settleDueSignals } from '@/lib/settlement';

export async function GET() {
  settleDueSignals();
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      uid: user.uid,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      capitalBalance: user.capital_balance,
      profitBalance: user.profit_balance,
      lockedProfitBalance: user.locked_profit_balance,
    },
  });
}
