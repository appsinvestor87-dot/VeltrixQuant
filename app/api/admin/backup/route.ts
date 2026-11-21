import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { getDb, getDbFilePath } from '@/lib/db';

const TABLE_NAMES = [
  'users',
  'admin_accounts',
  'payment_accounts',
  'deposits',
  'food_allowances',
  'withdrawals',
  'signals',
  'signal_claims',
  'ledger_transactions',
  'salary_levels',
  'salary_payouts',
  'donation_accounts',
  'donations',
  'system_settings',
  'about_resources',
  'chatbot_logs',
  'ip_locks',
  'admin_audit_logs',
] as const;

type CsvTableKey = 'users' | 'deposits' | 'withdrawals' | 'donations' | 'ledger';

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(','));
  return `${headerLine}\n${dataLines.join('\n')}\n`;
}

export async function GET(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const format = (req.nextUrl.searchParams.get('format') || '').toLowerCase();
  const db = getDb();
  const dbPath = getDbFilePath();

  if (!format) {
    let dbSizeBytes = 0;
    let walSizeBytes = 0;
    let lastModifiedAt = Date.now();
    try {
      const stat = fs.statSync(dbPath);
      dbSizeBytes = stat.size;
      lastModifiedAt = stat.mtimeMs;
    } catch {
      dbSizeBytes = 0;
    }
    try {
      const walStat = fs.statSync(`${dbPath}-wal`);
      walSizeBytes = walStat.size;
    } catch {
      walSizeBytes = 0;
    }

    const tables = TABLE_NAMES.map((name) => {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${name}`).get() as { cnt: number };
      return { name, rowCount: row.cnt || 0 };
    });

    const recentBackups = db
      .prepare(
        `SELECT id, admin_name, admin_role, details_json, ip_address, created_at
         FROM admin_audit_logs
         WHERE action = 'MANUAL_BACKUP'
         ORDER BY created_at DESC
         LIMIT 20`
      )
      .all();

    const res = NextResponse.json({
      dbFileName: path.basename(dbPath),
      dbSizeBytes,
      walSizeBytes,
      lastModifiedAt,
      tables,
      recentBackups,
    });
    return attachRefreshedAdminCookie(res, guard.admin);
  }

  if (guard.admin.role !== 'MASTER_ADMIN') {
    return NextResponse.json(
      { error: 'Only Master Admin can download manual database backups.' },
      { status: 403 }
    );
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ip = await getClientIp();

  if (format === 'db') {
    const tmpFile = path.join(os.tmpdir(), `veltrix-quant-backup-${stamp}-${process.pid}.db`);
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      const escapedPath = tmpFile.replace(/'/g, "''");
      db.exec(`VACUUM INTO '${escapedPath}';`);
      const buffer = fs.readFileSync(tmpFile);

      logAdminAudit({
        admin: guard.admin,
        action: 'MANUAL_BACKUP',
        targetType: 'DATABASE',
        targetId: 'SQLITE_SNAPSHOT',
        details: { format: 'SQLITE_DB', bytes: buffer.byteLength },
        ipAddress: ip,
      });

      const res = new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="veltrix-quant-backup-${stamp}.db"`,
          'Cache-Control': 'no-store',
        },
      });
      return attachRefreshedAdminCookie(res, guard.admin);
    } finally {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch {
        // ignore temp cleanup errors
      }
    }
  }

  if (format === 'json') {
    const safeUsers = db
      .prepare(
        `SELECT id, uid, username, full_name, email, referral_code, referred_by_id,
                bep20_address, bep20_locked, capital_balance, profit_balance, locked_profit_balance,
                total_deposited, total_withdrawn, total_earned, first_deposit_at,
                status, block_reason, token_version, last_login_ip, created_at
         FROM users ORDER BY id ASC`
      )
      .all();

    const safeAdmins = db
      .prepare(
        'SELECT id, trigger_id, role, display_name, token_version, is_active, created_at FROM admin_accounts ORDER BY id ASC'
      )
      .all();

    const archive = {
      exportedAt: new Date().toISOString(),
      exportedBy: guard.admin.displayName,
      platform: 'Veltrix Quant',
      schemaVersion: 2,
      tables: {
        users: safeUsers,
        admin_accounts: safeAdmins,
        payment_accounts: db.prepare('SELECT * FROM payment_accounts ORDER BY id ASC').all(),
        deposits: db.prepare('SELECT * FROM deposits ORDER BY id ASC').all(),
        food_allowances: db.prepare('SELECT * FROM food_allowances ORDER BY id ASC').all(),
        withdrawals: db.prepare('SELECT * FROM withdrawals ORDER BY id ASC').all(),
        signals: db.prepare('SELECT * FROM signals ORDER BY id ASC').all(),
        signal_claims: db.prepare('SELECT * FROM signal_claims ORDER BY id ASC').all(),
        ledger_transactions: db.prepare('SELECT * FROM ledger_transactions ORDER BY id ASC').all(),
        salary_levels: db.prepare('SELECT * FROM salary_levels ORDER BY level ASC').all(),
        salary_payouts: db.prepare('SELECT * FROM salary_payouts ORDER BY id ASC').all(),
        donation_accounts: db.prepare('SELECT * FROM donation_accounts ORDER BY id ASC').all(),
        donations: db.prepare('SELECT * FROM donations ORDER BY id ASC').all(),
        system_settings: db.prepare('SELECT * FROM system_settings ORDER BY key ASC').all(),
        about_resources: db.prepare('SELECT * FROM about_resources ORDER BY id ASC').all(),
        chatbot_logs: db.prepare('SELECT * FROM chatbot_logs ORDER BY id ASC').all(),
        ip_locks: db.prepare('SELECT * FROM ip_locks ORDER BY last_attempt_at DESC').all(),
        admin_audit_logs: db.prepare('SELECT * FROM admin_audit_logs ORDER BY id ASC').all(),
      },
    };

    const jsonBody = JSON.stringify(archive, null, 2);

    logAdminAudit({
      admin: guard.admin,
      action: 'MANUAL_BACKUP',
      targetType: 'DATABASE',
      targetId: 'JSON_ARCHIVE',
      details: { format: 'JSON', bytes: Buffer.byteLength(jsonBody, 'utf8') },
      ipAddress: ip,
    });

    const res = new NextResponse(jsonBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="veltrix-quant-archive-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
    return attachRefreshedAdminCookie(res, guard.admin);
  }

  if (format === 'csv') {
    const table = (req.nextUrl.searchParams.get('table') || 'users').toLowerCase() as CsvTableKey;
    let csv = '';

    if (table === 'users') {
      const rows = db
        .prepare(
          `SELECT id, uid, username, full_name, email, referral_code, referred_by_id,
                  bep20_address, capital_balance, profit_balance, locked_profit_balance,
                  total_deposited, total_withdrawn, total_earned, status, first_deposit_at, created_at
           FROM users ORDER BY id ASC`
        )
        .all() as Array<Record<string, unknown>>;
      csv = rowsToCsv(
        [
          'id',
          'uid',
          'username',
          'full_name',
          'email',
          'referral_code',
          'referred_by_id',
          'bep20_address',
          'capital_balance',
          'profit_balance',
          'locked_profit_balance',
          'total_deposited',
          'total_withdrawn',
          'total_earned',
          'status',
          'first_deposit_at',
          'created_at',
        ],
        rows
      );
    } else if (table === 'deposits') {
      const rows = db
        .prepare(
          `SELECT d.id, u.uid, u.username, d.amount, d.tx_hash, d.bsc_verified, d.status, d.reviewed_by, d.review_note, d.created_at, d.reviewed_at
           FROM deposits d JOIN users u ON u.id = d.user_id ORDER BY d.id ASC`
        )
        .all() as Array<Record<string, unknown>>;
      csv = rowsToCsv(
        [
          'id',
          'uid',
          'username',
          'amount',
          'tx_hash',
          'bsc_verified',
          'status',
          'reviewed_by',
          'review_note',
          'created_at',
          'reviewed_at',
        ],
        rows
      );
    } else if (table === 'withdrawals') {
      const rows = db
        .prepare(
          `SELECT w.id, u.uid, u.username, w.bep20_address, w.gross_amount, w.fee_percent, w.fee_amount, w.net_amount, w.status, w.payout_tx_hash, w.reviewed_by, w.created_at, w.reviewed_at
           FROM withdrawals w JOIN users u ON u.id = w.user_id ORDER BY w.id ASC`
        )
        .all() as Array<Record<string, unknown>>;
      csv = rowsToCsv(
        [
          'id',
          'uid',
          'username',
          'bep20_address',
          'gross_amount',
          'fee_percent',
          'fee_amount',
          'net_amount',
          'status',
          'payout_tx_hash',
          'reviewed_by',
          'created_at',
          'reviewed_at',
        ],
        rows
      );
    } else if (table === 'donations') {
      const rows = db
        .prepare(
          `SELECT dn.id, u.uid, u.username, dn.amount, dn.tx_hash, dn.note, dn.bsc_verified, dn.status, dn.reviewed_by, dn.review_note, dn.created_at, dn.reviewed_at
           FROM donations dn JOIN users u ON u.id = dn.user_id ORDER BY dn.id ASC`
        )
        .all() as Array<Record<string, unknown>>;
      csv = rowsToCsv(
        [
          'id',
          'uid',
          'username',
          'amount',
          'tx_hash',
          'note',
          'bsc_verified',
          'status',
          'reviewed_by',
          'review_note',
          'created_at',
          'reviewed_at',
        ],
        rows
      );
    } else if (table === 'ledger') {
      const rows = db
        .prepare(
          `SELECT l.id, u.uid, u.username, l.type, l.wallet_target, l.amount, l.balance_before, l.balance_after, l.reference_id, l.note, l.created_at
           FROM ledger_transactions l JOIN users u ON u.id = l.user_id ORDER BY l.id ASC`
        )
        .all() as Array<Record<string, unknown>>;
      csv = rowsToCsv(
        [
          'id',
          'uid',
          'username',
          'type',
          'wallet_target',
          'amount',
          'balance_before',
          'balance_after',
          'reference_id',
          'note',
          'created_at',
        ],
        rows
      );
    } else {
      return NextResponse.json({ error: 'Unsupported CSV table target.' }, { status: 400 });
    }

    logAdminAudit({
      admin: guard.admin,
      action: 'MANUAL_BACKUP',
      targetType: 'DATABASE',
      targetId: `CSV_${table.toUpperCase()}`,
      details: { format: 'CSV', table },
      ipAddress: ip,
    });

    const res = new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="veltrix-quant-${table}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
    return attachRefreshedAdminCookie(res, guard.admin);
  }

  return NextResponse.json({ error: 'Unsupported backup format.' }, { status: 400 });
}
