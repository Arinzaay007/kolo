/**
 * What "real" means for this app, in one place.
 *
 * Everything that must change when you point Kolo at real Mainnet funds instead of
 * the seeded demo lives here, so there is one file to check before a demo rather
 * than six hardcoded values scattered through the store.
 *
 * Every value has an honest default, and every override is read from the
 * environment. Nothing here is invented at runtime.
 */

const bool = (v: string | undefined) => v === '1' || v === 'true' || v === 'yes';

/** SUI is the default coin so a real test needs no USDC at all. */
export const COIN_TYPE_SUI = '0x2::sui::SUI';
export const COIN_TYPE_USDC =
  '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';

/** The coin a contribution is paid in. */
export function coinType(): string {
  return process.env.KOLO_COIN_TYPE || COIN_TYPE_SUI;
}

/**
 * A contribution, in base units. SUI has 9 decimals, USDC has 6 — so 0.01 SUI is
 * 10000000 and 20 USDC is 20000000. They look similar and are not; set this
 * explicitly when testing with real funds.
 */
export function contributionBase(): string {
  return process.env.KOLO_CONTRIBUTION_BASE || '1000000'; // 0.001 SUI
}

export function decimals(): number {
  return coinType() === COIN_TYPE_SUI ? 9 : 6;
}

/** Human amount, for the UI and the logs. */
export function formatAmount(base: string): string {
  const d = decimals();
  const n = Number(BigInt(base)) / 10 ** d;
  const sym = coinType() === COIN_TYPE_SUI ? 'SUI' : 'USDC';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: d })} ${sym}`;
}

export interface RoundWindow {
  startMs: number;
  endMs: number;
  /** How this window was decided, so it can be printed instead of assumed. */
  source: string;
}

/**
 * The window a contribution must land inside.
 *
 * Default is the last 7 days, ending now — which is what makes a transfer you make
 * today verify instead of reading as "outside this round". Override both ends for a
 * fixed window when rehearsing.
 */
export function roundWindow(now = Date.now()): RoundWindow {
  const explicitStart = process.env.KOLO_ROUND_START;
  const explicitEnd = process.env.KOLO_ROUND_END;
  if (explicitStart && explicitEnd) {
    return {
      startMs: Date.parse(explicitStart),
      endMs: Date.parse(explicitEnd),
      source: `KOLO_ROUND_START/KOLO_ROUND_END (${explicitStart} → ${explicitEnd})`,
    };
  }
  const days = Number(process.env.KOLO_ROUND_DAYS || 7);
  return {
    startMs: now - days * 24 * 60 * 60 * 1000,
    // A little slack at the end: chain timestamps lag "now" by a checkpoint or two,
    // and rejecting your own just-confirmed transfer would be a silly way to lose.
    endMs: now + 5 * 60 * 1000,
    source: `last ${days} day(s), ending now`,
  };
}

/** Real addresses, if they have been set. Absent means the seed keeps its placeholders. */
export function accountOverride(member: string): string | undefined {
  const key = `KOLO_ADDR_${member.toUpperCase()}`;
  const value = process.env[key];
  if (!value) return undefined;
  if (!/^0x[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`${key} is not a Sui address (expected 0x and 64 hex characters)`);
  }
  return value;
}

/** True when at least one member has a real address, i.e. this is not a pure fixture run. */
export function hasRealAddresses(): boolean {
  return ['ADA', 'EMEKA', 'TUNDE', 'NGOZI', 'BOLA'].some((m) => Boolean(process.env[`KOLO_ADDR_${m}`]));
}

/** Prints what the app believes it is pointing at. Called by the scripts, never by the UI. */
export function describe(): string[] {
  const w = roundWindow();
  return [
    `coin            ${coinType()}`,
    `contribution    ${formatAmount(contributionBase())} (${contributionBase()} base units)`,
    `round window    ${new Date(w.startMs).toISOString()} → ${new Date(w.endMs).toISOString()}`,
    `                ${w.source}`,
    `real addresses  ${hasRealAddresses() ? 'yes (from env)' : 'no — seeded placeholders'}`,
    `strict verify   ${bool(process.env.KOLO_STRICT_VERIFY) ? 'yes' : 'no'}`,
  ];
}
