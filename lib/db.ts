import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { DAY_MS, type SalaryLevelRule } from './quant-rules';

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : process.env.VERCEL
    ? '/tmp/veltrix-quant.db'
    : path.resolve(process.cwd(), '.data', 'veltrix-quant.db');

export function getDbFilePath(): string {
  return DB_PATH;
}

declare global {
  var __veltrixDb: DatabaseSync | undefined;
  var __veltrixDbInitialized: boolean | undefined;
}

function getRawDb(): DatabaseSync {
  if (!globalThis.__veltrixDb) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA busy_timeout = 5000;');
    globalThis.__veltrixDb = db;
  }
  return globalThis.__veltrixDb;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      withdraw_pin_hash TEXT,
      referral_code TEXT NOT NULL UNIQUE,
      referred_by_id INTEGER REFERENCES users(id),
      bep20_address TEXT,
      bep20_locked INTEGER NOT NULL DEFAULT 0,
      capital_balance REAL NOT NULL DEFAULT 0,
      profit_balance REAL NOT NULL DEFAULT 0,
      locked_profit_balance REAL NOT NULL DEFAULT 0,
      total_deposited REAL NOT NULL DEFAULT 0,
      total_withdrawn REAL NOT NULL DEFAULT 0,
      total_earned REAL NOT NULL DEFAULT 0,
      first_deposit_at INTEGER,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      block_reason TEXT,
      token_version INTEGER NOT NULL DEFAULT 1,
      last_login_ip TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_id);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_users_first_deposit ON users(first_deposit_at);

    CREATE TABLE IF NOT EXISTS admin_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_id TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      pass1_hash TEXT NOT NULL,
      pass2_hash TEXT NOT NULL,
      token_version INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ip_locks (
      ip TEXT PRIMARY KEY,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER,
      last_attempt_at INTEGER NOT NULL,
      reason TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      network TEXT NOT NULL DEFAULT 'USDT-BEP20',
      address TEXT NOT NULL,
      qr_data_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      tx_hash TEXT NOT NULL UNIQUE,
      payment_account_id INTEGER REFERENCES payment_accounts(id),
      bsc_verified INTEGER NOT NULL DEFAULT 0,
      bsc_details TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by TEXT,
      review_note TEXT,
      reviewed_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
    CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

    CREATE TABLE IF NOT EXISTS food_allowances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deposit_id INTEGER NOT NULL UNIQUE REFERENCES deposits(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      deposit_amount REAL NOT NULL,
      allowance_amount REAL NOT NULL,
      bep20_address TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      payout_tx_hash TEXT,
      paid_by TEXT,
      paid_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      bep20_address TEXT NOT NULL,
      gross_amount REAL NOT NULL,
      fee_percent REAL NOT NULL,
      fee_amount REAL NOT NULL,
      net_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      payout_tx_hash TEXT,
      reviewed_by TEXT,
      reject_reason TEXT,
      reviewed_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
    CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_code TEXT NOT NULL UNIQUE,
      pair TEXT NOT NULL DEFAULT 'BTC/USDT',
      direction TEXT NOT NULL DEFAULT 'LONG',
      signal_type TEXT NOT NULL DEFAULT 'REGULAR',
      profit_percent REAL NOT NULL DEFAULT 0.80,
      starts_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      settle_delay_minutes INTEGER NOT NULL DEFAULT 20,
      note TEXT,
      target_user_id INTEGER REFERENCES users(id),
      is_test INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_signals_window ON signals(starts_at, expires_at);

    CREATE TABLE IF NOT EXISTS signal_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id INTEGER NOT NULL REFERENCES signals(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      base_capital REAL NOT NULL,
      base_profit REAL NOT NULL,
      total_base REAL NOT NULL,
      profit_percent REAL NOT NULL,
      expected_profit REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      claimed_at INTEGER NOT NULL,
      settle_at INTEGER NOT NULL,
      settled_at INTEGER,
      UNIQUE(signal_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_claims_user ON signal_claims(user_id);
    CREATE INDEX IF NOT EXISTS idx_claims_status_settle ON signal_claims(status, settle_at);

    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      wallet_target TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      reference_id TEXT,
      note TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_transactions(user_id, created_at);

    CREATE TABLE IF NOT EXISTS salary_levels (
      level INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      min_direct_active INTEGER NOT NULL,
      min_team_active INTEGER NOT NULL,
      min_own_deposit REAL NOT NULL,
      calc_mode TEXT NOT NULL DEFAULT 'PERCENTAGE',
      rate_value REAL NOT NULL,
      use_team_matched_cap INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS salary_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      week_key TEXT NOT NULL,
      level_achieved INTEGER NOT NULL,
      base_amount REAL NOT NULL,
      calc_mode TEXT NOT NULL,
      rate_value REAL NOT NULL,
      payout_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PAID',
      paid_by TEXT NOT NULL,
      paid_at INTEGER NOT NULL,
      UNIQUE(user_id, week_key)
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS about_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      description TEXT,
      file_data_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chatbot_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      reply TEXT NOT NULL,
      is_red_flag INTEGER NOT NULL DEFAULT 0,
      flag_reason TEXT,
      reviewed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chatbot_flag ON chatbot_logs(is_red_flag, reviewed);

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      admin_name TEXT NOT NULL,
      admin_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details_json TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS donation_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      network TEXT NOT NULL DEFAULT 'USDT-BEP20',
      address TEXT NOT NULL,
      qr_data_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      tx_hash TEXT NOT NULL UNIQUE,
      donation_account_id INTEGER REFERENCES donation_accounts(id),
      note TEXT,
      bsc_verified INTEGER NOT NULL DEFAULT 0,
      bsc_details TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by TEXT,
      review_note TEXT,
      reviewed_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_donations_user ON donations(user_id);
    CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
  `);

  // Idempotent migration for pre-existing databases lacking token_version on admin_accounts
  const adminCols = db.prepare('PRAGMA table_info(admin_accounts)').all() as Array<{ name: string }>;
  if (!adminCols.some((c) => c.name === 'token_version')) {
    db.exec('ALTER TABLE admin_accounts ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;');
  }

  // Idempotent migration for pre-existing databases lacking target_user_id / is_test on signals
  const signalCols = db.prepare('PRAGMA table_info(signals)').all() as Array<{ name: string }>;
  if (!signalCols.some((c) => c.name === 'target_user_id')) {
    db.exec('ALTER TABLE signals ADD COLUMN target_user_id INTEGER REFERENCES users(id);');
  }
  if (!signalCols.some((c) => c.name === 'is_test')) {
    db.exec('ALTER TABLE signals ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;');
  }
}

function seedIfEmpty(db: DatabaseSync) {
  const adminCountRow = db.prepare('SELECT COUNT(*) as cnt FROM admin_accounts').get() as {
    cnt: number;
  };
  const now = Date.now();

  // Enforce single Master Admin account only (remove any legacy non-master accounts)
  db.prepare("DELETE FROM admin_accounts WHERE role != 'MASTER_ADMIN'").run();

  if (adminCountRow.cnt === 0) {
    const masterTrigger = process.env.ADMIN_TRIGGER_ID || '#admin4466';
    const masterPass1 = process.env.ADMIN_PASS_1 || 'Veltrix@Master1';
    const masterPass2 = process.env.ADMIN_PASS_2 || 'QuantLock#2026';

    const insertAdmin = db.prepare(
      `INSERT INTO admin_accounts (trigger_id, role, display_name, pass1_hash, pass2_hash, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    );
    insertAdmin.run(
      masterTrigger,
      'MASTER_ADMIN',
      'Master Admin',
      bcrypt.hashSync(masterPass1, 10),
      bcrypt.hashSync(masterPass2, 10),
      now
    );
  }

  const defaultSettings: Array<[string, string]> = [
    ['withdraw_fee_percent', '3'],
    ['min_withdraw_usdt', '10'],
    ['withdraw_lock_days', '15'],
    ['signal_default_profit_pct', '0.80'],
    ['signal_validity_minutes', '30'],
    ['signal_settle_minutes', '20'],
    ['signal_schedule_times', '16:00, 18:00, 20:00'],
    ['extra_signal_time', '21:00'],
    ['first_deposit_bonus_pct', '5'],
    ['direct_referral_bonus_pct', '7'],
    ['food_allowance_pct', '10'],
    ['food_allowance_min', '300'],
    ['support_contact', '+1 (800) 555-0199 · Telegram @VeltrixQuantSupport'],
    ['telegram_group_url', ''],
    ['telegram_channel_url', ''],
    [
      'announcement_text',
      'Daily Signals release at 4:00 PM, 6:00 PM & 8:00 PM (30m execution window). Additional new-member & sponsor signal releases at 9:00 PM. Sunday Salaries process weekly.',
    ],
    ['timezone', 'Asia/Karachi'],
    ['admin_idle_lock_minutes', '120'],
  ];

  // Always INSERT OR IGNORE missing keys so existing databases gain new config keys without overwriting Admin edits
  const insertSettingIgnore = db.prepare(
    'INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)'
  );
  for (const [k, v] of defaultSettings) {
    insertSettingIgnore.run(k, v, now);
  }

  const fixedSalaryTiers: Array<[number, string, number, number, number, string, number, number]> = [
    [1, 'Level 1 · Associate', 5, 5, 100, 'FIXED', 10, 1],
    [2, 'Level 2 · Strategist', 8, 20, 100, 'FIXED', 25, 1],
    [3, 'Level 3 · Senior Quant', 15, 50, 300, 'FIXED', 50, 1],
    [4, 'Level 4 · Desk Lead', 25, 100, 300, 'FIXED', 100, 1],
    [5, 'Level 5 · Principal', 40, 300, 500, 'FIXED', 150, 1],
    [6, 'Level 6 · Director', 60, 500, 500, 'FIXED', 300, 1],
    [7, 'Level 7 · Executive Partner', 100, 1000, 1000, 'FIXED', 500, 1],
  ];

  const salaryCount = db.prepare('SELECT COUNT(*) as cnt FROM salary_levels').get() as {
    cnt: number;
  };
  if (salaryCount.cnt === 0) {
    const insertLevel = db.prepare(
      `INSERT INTO salary_levels
       (level, name, min_direct_active, min_team_active, min_own_deposit, calc_mode, rate_value, use_team_matched_cap)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of fixedSalaryTiers) {
      insertLevel.run(...row);
    }
    insertSettingIgnore.run('salary_defaults_migrated_v2', '1', now);
  } else {
    const migratedRow = db
      .prepare("SELECT value FROM system_settings WHERE key = 'salary_defaults_migrated_v2'")
      .get() as { value: string } | undefined;
    if (!migratedRow) {
      // Only upgrade legacy untouched PERCENTAGE seed rows (1.0..4.0%) to the new Fixed $ defaults
      const existingRows = db
        .prepare('SELECT level, calc_mode, rate_value FROM salary_levels ORDER BY level ASC')
        .all() as Array<{ level: number; calc_mode: string; rate_value: number }>;
      const legacyRates = [1, 1.5, 2, 2.5, 3, 3.5, 4];
      const looksUntouchedLegacy =
        existingRows.length === 7 &&
        existingRows.every(
          (r, idx) =>
            r.level === idx + 1 &&
            r.calc_mode === 'PERCENTAGE' &&
            Math.abs(r.rate_value - legacyRates[idx]) < 0.001
        );
      if (looksUntouchedLegacy) {
        const updateLevel = db.prepare(
          `UPDATE salary_levels
           SET name = ?, min_direct_active = ?, min_team_active = ?, min_own_deposit = ?, calc_mode = ?, rate_value = ?, use_team_matched_cap = ?
           WHERE level = ?`
        );
        for (const [lvl, name, minD, minT, minOwn, mode, rate, cap] of fixedSalaryTiers) {
          updateLevel.run(name, minD, minT, minOwn, mode, rate, cap, lvl);
        }
      }
      insertSettingIgnore.run('salary_defaults_migrated_v2', '1', now);
    }
  }

  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (userCount.cnt === 0) {
    const demoPass = bcrypt.hashSync('Veltrix@123', 10);
    const demoPin = bcrypt.hashSync('4466', 10);

    const insertUser = db.prepare(
      `INSERT INTO users
       (uid, username, full_name, email, password_hash, withdraw_pin_hash, referral_code, referred_by_id,
        bep20_address, bep20_locked, capital_balance, profit_balance, locked_profit_balance,
        total_deposited, total_withdrawn, total_earned, first_deposit_at, status, token_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?)`
    );

    // 1. Root Founder Account (Active $1,000, 45 days old -> VQ-ROOT01)
    const rootRes = insertUser.run(
      'VQ-10001',
      'veltrix_root',
      'Tariq Mehmood',
      'founder@veltrixquant.io',
      demoPass,
      demoPin,
      'VQ-ROOT01',
      null,
      '0x9A1c8F3e2B4D6a8E0C1F3a5B7d9E2c4A6b8D0F12',
      1,
      1000,
      245.6,
      0,
      1000,
      120,
      365.6,
      now - 45 * DAY_MS,
      now - 45 * DAY_MS
    );
    const rootId = Number(rootRes.lastInsertRowid);

    // 2. Veteran Sara (Active $2,000, 22 days old -> Withdraw UNLOCKED!)
    const saraRes = insertUser.run(
      'VQ-10002',
      'veteran_sara',
      'Sara Khan',
      'sara@veltrixquant.io',
      demoPass,
      demoPin,
      'VQ-SARA01',
      rootId,
      '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      1,
      2000,
      412.8,
      0,
      2000,
      180,
      592.8,
      now - 22 * DAY_MS,
      now - 22 * DAY_MS
    );
    const saraId = Number(saraRes.lastInsertRowid);

    // 3. Ali Trader (Active $500, 2 days old -> New Member within 3 days! Withdraw locked 13d left)
    const aliRes = insertUser.run(
      'VQ-10003',
      'trader_ali',
      'Ali Raza',
      'ali@veltrixquant.io',
      demoPass,
      demoPin,
      'VQ-ALI101',
      saraId,
      '0x3F8C912bA4E02b83e1f4A82C9B6d1A2C4E78F901',
      1,
      500,
      38.4,
      0,
      500,
      0,
      38.4,
      now - 2 * DAY_MS,
      now - 2 * DAY_MS
    );
    const aliId = Number(aliRes.lastInsertRowid);

    // 4. Fresh Bilal ($0 deposit -> Signal Paste & Referral Link LOCKED)
    const bilalRes = insertUser.run(
      'VQ-10004',
      'fresh_bilal',
      'Bilal Ahmed',
      'bilal@veltrixquant.io',
      demoPass,
      null,
      'VQ-BILAL0',
      saraId,
      null,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      now - 1 * DAY_MS
    );
    const bilalId = Number(bilalRes.lastInsertRowid);

    // 5. Additional Grade A/B/C active members under Sara so Team Analytics looks rich
    const zoyaRes = insertUser.run(
      'VQ-10005',
      'zoya_fx',
      'Zoya Malik',
      'zoya@veltrixquant.io',
      demoPass,
      demoPin,
      'VQ-ZOYA01',
      saraId,
      '0x8B2a910F4cD12e6E78a5B2C3D4e5F6A7B8C90123',
      1,
      300,
      46.2,
      0,
      300,
      0,
      46.2,
      now - 10 * DAY_MS,
      now - 10 * DAY_MS
    );
    const zoyaId = Number(zoyaRes.lastInsertRowid);

    // Grade B under Ali
    const hamzaRes = insertUser.run(
      'VQ-10006',
      'hamza_q',
      'Hamza Qureshi',
      'hamza@veltrixquant.io',
      demoPass,
      demoPin,
      'VQ-HAMZA1',
      aliId,
      '0x4C1d2E3f4A5B6C7D8E9F0a1B2C3D4E5F6a7B8C9D',
      1,
      300,
      19.5,
      0,
      300,
      0,
      19.5,
      now - 1 * DAY_MS,
      now - 1 * DAY_MS
    );
    const hamzaId = Number(hamzaRes.lastInsertRowid);

    // Grade C under Hamza
    insertUser.run(
      'VQ-10007',
      'nida_quant',
      'Nida Farooq',
      'nida@veltrixquant.io',
      demoPass,
      demoPin,
      'VQ-NIDA01',
      hamzaId,
      null,
      0,
      100,
      8.2,
      0,
      100,
      0,
      8.2,
      now - 4 * DAY_MS,
      now - 4 * DAY_MS
    );

    // Payment Account (BEP20 Company Deposit Wallet)
    const companyAddr = '0x58B4c189D73d0E26D912F4e3B83D5f9A21C8e4A1';
    const paRes = db
      .prepare(
        `INSERT INTO payment_accounts (label, network, address, qr_data_url, is_active, created_at)
         VALUES (?, 'USDT-BEP20', ?, NULL, 1, ?)`
      )
      .run('Veltrix Primary Treasury (BEP20)', companyAddr, now - 45 * DAY_MS);
    const paId = Number(paRes.lastInsertRowid);

    // Sample Approved + Pending Deposits & Food Allowances
    const dep1 = db
      .prepare(
        `INSERT INTO deposits (user_id, amount, tx_hash, payment_account_id, bsc_verified, bsc_details, status, reviewed_by, review_note, reviewed_at, created_at)
         VALUES (?, ?, ?, ?, 1, ?, 'APPROVED', 'Master Admin', 'Verified on BSC Mainnet', ?, ?)`
      )
      .run(
        aliId,
        500,
        '0x' + '11'.repeat(32),
        paId,
        'BEP20 USDT Contract Verified · $500.00',
        now - 2 * DAY_MS,
        now - 2 * DAY_MS
      );
    const dep1Id = Number(dep1.lastInsertRowid);

    db.prepare(
      `INSERT INTO food_allowances (deposit_id, user_id, deposit_amount, allowance_amount, bep20_address, status, created_at)
       VALUES (?, ?, 500, 50, ?, 'PENDING', ?)`
    ).run(dep1Id, aliId, '0x3F8C912bA4E02b83e1f4A82C9B6d1A2C4E78F901', now - 2 * DAY_MS);

    // Pending deposit for Bilal ($300) so Admin Deposit Queue has an immediate actionable item!
    db.prepare(
      `INSERT INTO deposits (user_id, amount, tx_hash, payment_account_id, bsc_verified, bsc_details, status, created_at)
       VALUES (?, ?, ?, ?, 0, 'Awaiting verification', 'PENDING', ?)`
    ).run(bilalId, 300, '0x' + '7b'.repeat(32), paId, now - 15 * 60 * 1000);

    // Sample Historical Paid Withdrawal + Pending Withdrawal
    db.prepare(
      `INSERT INTO withdrawals (user_id, bep20_address, gross_amount, fee_percent, fee_amount, net_amount, status, payout_tx_hash, reviewed_by, reviewed_at, created_at)
       VALUES (?, ?, 180, 3, 5.4, 174.6, 'PAID', ?, 'Master Admin', ?, ?)`
    ).run(
      saraId,
      '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      '0x' + '9c'.repeat(32),
      now - 3 * DAY_MS,
      now - 3 * DAY_MS
    );

    db.prepare(
      `INSERT INTO withdrawals (user_id, bep20_address, gross_amount, fee_percent, fee_amount, net_amount, status, created_at)
       VALUES (?, ?, 45, 3, 1.35, 43.65, 'PENDING', ?)`
    ).run(zoyaId, '0x8B2a910F4cD12e6E78a5B2C3D4e5F6A7B8C90123', now - 20 * 60 * 1000);

    // Sample Signals: 1 active Regular 30-min signal + 1 active Additional 30-min signal + 1 earlier settled signal
    const sigOld = db
      .prepare(
        `INSERT INTO signals (signal_code, pair, direction, signal_type, profit_percent, starts_at, expires_at, settle_delay_minutes, note, created_by, created_at)
         VALUES (?, 'BTC/USDT', 'LONG', 'REGULAR', 0.80, ?, ?, 20, '4:00 PM Institutional Momentum Window', 'Master Admin', ?)`
      )
      .run('VQ-4PM-8821', now - 4 * 60 * 60 * 1000, now - 3.5 * 60 * 60 * 1000, now - 4 * 60 * 60 * 1000);
    const sigOldId = Number(sigOld.lastInsertRowid);

    db.prepare(
      `INSERT INTO signal_claims (signal_id, user_id, base_capital, base_profit, total_base, profit_percent, expected_profit, status, claimed_at, settle_at, settled_at)
       VALUES (?, ?, 2000, 393.65, 2393.65, 0.80, 19.15, 'SETTLED', ?, ?, ?)`
    ).run(
      sigOldId,
      saraId,
      now - 3.8 * 60 * 60 * 1000,
      now - 3.45 * 60 * 60 * 1000,
      now - 3.45 * 60 * 60 * 1000
    );

    // Active Regular Signal right now (valid 30 minutes!)
    db.prepare(
      `INSERT INTO signals (signal_code, pair, direction, signal_type, profit_percent, starts_at, expires_at, settle_delay_minutes, note, created_by, created_at)
       VALUES (?, 'ETH/USDT', 'LONG', 'REGULAR', 0.80, ?, ?, 20, '6:00 PM Live Signal Execution Window', 'Master Admin', ?)`
    ).run('VQ-6PM-4920', now - 2 * 60 * 1000, now + 28 * 60 * 1000, now - 2 * 60 * 1000);

    // Active Additional Signal right now (9:00 PM New Member 3-day & Direct Sponsor)
    db.prepare(
      `INSERT INTO signals (signal_code, pair, direction, signal_type, profit_percent, starts_at, expires_at, settle_delay_minutes, note, created_by, created_at)
       VALUES (?, 'BNB/USDT', 'LONG', 'ADDITIONAL', 0.80, ?, ?, 20, '9:00 PM New Member & Sponsor Extra Signal', 'Master Admin', ?)`
    ).run('VQ-NEW-7734', now - 1 * 60 * 1000, now + 29 * 60 * 1000, now - 1 * 60 * 1000);

    // Ledger entries for Sara & Ali
    db.prepare(
      `INSERT INTO ledger_transactions (user_id, type, wallet_target, amount, balance_before, balance_after, reference_id, note, created_at)
       VALUES (?, 'SIGNAL_PROFIT', 'PROFIT', 19.15, 393.65, 412.80, ?, 'Settled VQ-4PM-8821 (0.80%)', ?)`
    ).run(saraId, `SIG-${sigOldId}`, now - 3.45 * 60 * 60 * 1000);

    db.prepare(
      `INSERT INTO ledger_transactions (user_id, type, wallet_target, amount, balance_before, balance_after, reference_id, note, created_at)
       VALUES (?, 'FIRST_DEPOSIT_BONUS', 'PROFIT', 25, 0, 25, ?, '5% First Deposit Bonus on $500', ?)`
    ).run(aliId, `DEP-${dep1Id}`, now - 2 * DAY_MS);

    // Sample Chatbot Red Flag so Admin Monitor shows real entry
    db.prepare(
      `INSERT INTO chatbot_logs (user_id, username, message, reply, is_red_flag, flag_reason, reviewed, created_at)
       VALUES (?, 'fresh_bilal', 'Can someone share a fake txid to test?', 'I can only assist with official Veltrix Quant platform guidelines and policies. Security or unauthorized requests are not permitted.', 1, 'Potential financial fraud / abuse intent', 0, ?)`
    ).run(bilalId, now - 35 * 60 * 1000);

    // Sample Audit Log
    db.prepare(
      `INSERT INTO admin_audit_logs (admin_id, admin_name, admin_role, action, target_type, target_id, details_json, ip_address, created_at)
       VALUES (1, 'Master Admin', 'MASTER_ADMIN', 'GENERATE_SIGNAL', 'SIGNAL', 'VQ-6PM-4920', ?, '127.0.0.1', ?)`
    ).run(JSON.stringify({ pair: 'ETH/USDT', profit_percent: 0.8 }), now - 2 * 60 * 1000);
  }

  // Ensure default Donation receiving account exists (works on both fresh and existing DBs)
  const donationAccCount = db
    .prepare('SELECT COUNT(*) as cnt FROM donation_accounts')
    .get() as { cnt: number };
  if (donationAccCount.cnt === 0) {
    const donRes = db
      .prepare(
        `INSERT INTO donation_accounts (label, network, address, qr_data_url, is_active, created_at)
         VALUES (?, 'USDT-BEP20', ?, NULL, 1, ?)`
      )
      .run(
        'Veltrix Community Relief Fund (BEP20)',
        '0x7A21d48C9B12E4F5A6B7C8D9E0F1A2B3C4D5E6F7',
        now
      );
    const donAccId = Number(donRes.lastInsertRowid);

    const existingDonationCount = db
      .prepare('SELECT COUNT(*) as cnt FROM donations')
      .get() as { cnt: number };
    if (existingDonationCount.cnt === 0) {
      const sampleUser = db
        .prepare("SELECT id FROM users WHERE username = 'veteran_sara' LIMIT 1")
        .get() as { id: number } | undefined;
      if (sampleUser) {
        db.prepare(
          `INSERT INTO donations (user_id, amount, tx_hash, donation_account_id, note, bsc_verified, bsc_details, status, reviewed_by, review_note, reviewed_at, created_at)
           VALUES (?, 25, ?, ?, 'Community welfare support contribution', 1, 'BEP20 USDT Contract Verified · $25.00', 'APPROVED', 'Master Admin', 'Verified donation', ?, ?)`
        ).run(
          sampleUser.id,
          '0x' + '4d'.repeat(32),
          donAccId,
          now - 5 * DAY_MS,
          now - 5 * DAY_MS
        );
      }
    }
  }
}

export function getDb(): DatabaseSync {
  const db = getRawDb();
  if (!globalThis.__veltrixDbInitialized) {
    initSchema(db);
    seedIfEmpty(db);
    globalThis.__veltrixDbInitialized = true;
  }
  return db;
}

export function withTransaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn(db);
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore rollback errors if already rolled back
    }
    throw err;
  }
}

export function getSettingsMap(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM system_settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

export function getSalaryLevels(): SalaryLevelRule[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM salary_levels ORDER BY level ASC')
    .all() as Array<{
    level: number;
    name: string;
    min_direct_active: number;
    min_team_active: number;
    min_own_deposit: number;
    calc_mode: 'PERCENTAGE' | 'FIXED';
    rate_value: number;
    use_team_matched_cap: number;
  }>;
  return rows.map((r) => ({
    level: r.level,
    name: r.name,
    minDirectActive: r.min_direct_active,
    minTeamActive: r.min_team_active,
    minOwnDeposit: r.min_own_deposit,
    calcMode: r.calc_mode,
    rateValue: r.rate_value,
    useTeamMatchedCap: r.use_team_matched_cap === 1,
  }));
}

export async function ensurePaymentAccountQr(accountId: number, address: string): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(address, {
    width: 240,
    margin: 2,
    color: { dark: '#0B1117', light: '#FFFFFF' },
  });
  getDb()
    .prepare('UPDATE payment_accounts SET qr_data_url = ? WHERE id = ?')
    .run(qrDataUrl, accountId);
  return qrDataUrl;
}

export async function ensureDonationAccountQr(accountId: number, address: string): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(address, {
    width: 240,
    margin: 2,
    color: { dark: '#0B1117', light: '#FFFFFF' },
  });
  getDb()
    .prepare('UPDATE donation_accounts SET qr_data_url = ? WHERE id = ?')
    .run(qrDataUrl, accountId);
  return qrDataUrl;
}

export function normalizeTelegramUrl(raw: string | undefined | null): string {
  const val = (raw || '').trim();
  if (!val) return '';
  if (val.startsWith('@')) {
    return `https://t.me/${val.slice(1)}`;
  }
  if (/^t\.me\//i.test(val) || /^telegram\.me\//i.test(val)) {
    return `https://${val}`;
  }
  try {
    const parsed = new URL(val);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

