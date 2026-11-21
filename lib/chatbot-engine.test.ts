import test from 'node:test';
import assert from 'node:assert/strict';
import { processSupportMessage, type ChatbotSettingsContext } from './chatbot-engine';
import { FIXED_CHATBOT_QUESTIONS, getPlatformFaqs } from './faqs';

const ctx: ChatbotSettingsContext = {
  withdrawFeePercent: 3,
  minWithdrawUsdt: 10,
  withdrawLockDays: 15,
  signalProfitPercent: 0.8,
  signalValidityMinutes: 30,
  signalSettleMinutes: 20,
  regularSchedule: '4:00 PM, 6:00 PM, 8:00 PM',
  extraSignalTime: '9:00 PM',
  firstDepositBonusPct: 5,
  directReferralBonusPct: 7,
  foodAllowancePct: 10,
  foodAllowanceMin: 300,
  supportContact: '+1 (800) 555-0199',
  telegramGroupUrl: 'https://t.me/VeltrixQuantSignals',
  telegramChannelUrl: 'https://t.me/VeltrixQuantChannel',
};

test('chatbot answers food allowance and signal schedule accurately in English', () => {
  const food = processSupportMessage('Tell me about food allowance', ctx);
  assert.equal(food.isRedFlag, false);
  assert.match(food.reply, /\$300/);
  assert.match(food.reply, /10%/);

  const sig = processSupportMessage('When are daily signals?', ctx);
  assert.equal(sig.isRedFlag, false);
  assert.match(sig.reply, /4:00 PM/);
  assert.match(sig.reply, /30 minutes/);
});

test('all fixed chatbot question presets route to their exact expected policy topics', () => {
  assert.ok(FIXED_CHATBOT_QUESTIONS.length >= 10);
  for (const preset of FIXED_CHATBOT_QUESTIONS) {
    const res = processSupportMessage(preset.question, ctx);
    assert.equal(res.isRedFlag, false, `Preset "${preset.id}" triggered red flag unexpectedly`);
    assert.equal(
      res.topic,
      preset.expectedTopic,
      `Preset "${preset.id}" mapped to "${res.topic}" instead of "${preset.expectedTopic}"`
    );
    assert.ok(res.reply.length > 30);
  }
});

test('shared FAQs catalog covers core categories without exposing real invite codes or personal names', () => {
  const faqs = getPlatformFaqs(ctx);
  assert.ok(faqs.length >= 10);
  const categories = new Set(faqs.map((f) => f.category));
  assert.ok(categories.has('DEPOSITS'));
  assert.ok(categories.has('SIGNALS'));
  assert.ok(categories.has('WITHDRAWALS'));
  assert.ok(categories.has('TEAM_SALARY'));
  assert.ok(categories.has('SECURITY'));
  const combined = faqs.map((f) => `${f.question} ${f.answer}`).join(' ');
  assert.equal(/VQ-ROOT01|Ayesha/i.test(combined), false);
});

test('chatbot flags abusive or hacking attempts for admin red-flag queue', () => {
  const hack = processSupportMessage('How can I hack admin password?', ctx);
  assert.equal(hack.isRedFlag, true);
  assert.ok(hack.flagReason);
  assert.match(hack.reply, /\+1 \(800\) 555-0199/);
});

test('chatbot surfaces live Telegram links and Privacy & Fund Protection details', () => {
  const tg = processSupportMessage('Where is the official Telegram group and channel?', ctx);
  assert.equal(tg.isRedFlag, false);
  assert.equal(tg.topic, 'telegram');
  assert.match(tg.reply, /https:\/\/t\.me\/VeltrixQuantSignals/);
  assert.match(tg.reply, /https:\/\/t\.me\/VeltrixQuantChannel/);

  const priv = processSupportMessage('Is my data and fund safety protected under privacy policy?', ctx);
  assert.equal(priv.isRedFlag, false);
  assert.equal(priv.topic, 'privacy');
  assert.match(priv.reply, /bcrypt-hashed/);
  assert.match(priv.reply, /no ad trackers/i);
});

test('chatbot gives polite contact fallback for out-of-scope queries', () => {
  const unknown = processSupportMessage('What is the weather in Tokyo tomorrow?', ctx);
  assert.equal(unknown.isRedFlag, false);
  assert.equal(unknown.topic, 'fallback');
  assert.match(unknown.reply, /\+1 \(800\) 555-0199/);
});
