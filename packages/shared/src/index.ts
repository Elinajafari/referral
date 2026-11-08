/**
 * Types and pure rules shared by the Referral contract
 * (packages/contracts/referral.py) and any client that reads it: a
 * referral dashboard, a bot, another app.
 *
 * Two kinds of thing live here:
 *
 *   1. The SHAPE of what the contract's views return, with a parser that
 *      refuses anything else. The bonus comes back as a decimal string and
 *      is parsed to bigint, because it can exceed what a number holds.
 *      genlayer-js 1.1.8 returns plain objects; older builds returned Map, so
 *      the parser accepts both.
 *
 *   2. A PORT of the contract's deterministic rules: how caller text is
 *      cleaned, the referred-person dedupe digest, how a model's answer is
 *      read back through the order it was asked in, and how the two orders
 *      fold into one verdict. A port that disagrees with the contract is
 *      worse than none, so it is tested against referral-vectors.json, which
 *      is generated FROM the contract's own functions and read by its
 *      Python tests too.
 */

// ---------------------------------------------------------------- tokens

export const QUALIFYING = "qualifying" as const;
export const NOT_QUALIFYING = "not_qualifying" as const;
export const VERDICTS = ["", QUALIFYING, NOT_QUALIFYING] as const;
export type Verdict = (typeof VERDICTS)[number];
export const STATUSES = ["open", "closed"] as const;
export type Status = (typeof STATUSES)[number];

/** The order the options are asked in first, and then reversed. */
export const FORWARD = [QUALIFYING, NOT_QUALIFYING] as const;
export const REVERSED = [NOT_QUALIFYING, QUALIFYING] as const;

// ---------------------------------------------------------------- shapes

export interface Program {
  criteria: string;
  company: string;
  bonus: bigint;
  max_referrals: number;
  pool: bigint;
  left: bigint;
  paid_total: bigint;
  returned: bigint;
  status: Status;
  referrals: number;
  paid: number;
  opened_at: string;
  closes_at: string;
  closed_at: string;
}

export interface Referral {
  id: number;
  program: number;
  referrer: string;
  referred: string;
  evidence: string;
  at: string;
  verdict: Verdict;
  /** leader-supplied and NOT part of consensus */
  why: string;
  paid: bigint;
  reason_is_leader_supplied: boolean;
}

type Raw = Record<string, unknown>;

function record(v: unknown): Raw | null {
  if (v instanceof Map) return Object.fromEntries(v.entries()) as Raw;
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Raw;
  return null;
}

function num(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`expected a number, got ${String(v)}`);
  return n;
}

function str(v: unknown): string {
  if (typeof v !== "string") throw new Error(`expected a string, got ${typeof v}`);
  return v;
}

function wei(v: unknown): bigint {
  const s = str(v);
  if (!/^[0-9]+$/.test(s)) throw new Error(`expected an amount of wei, got ${s}`);
  return BigInt(s);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], what: string): T {
  const s = str(v);
  if (!(allowed as readonly string[]).includes(s)) throw new Error(`unexpected ${what}: ${s}`);
  return s as T;
}

export function parseProgram(v: unknown): Program {
  const r = record(v);
  if (!r) throw new Error("program is not an object");
  return {
    criteria: str(r.criteria), company: str(r.company), bonus: wei(r.bonus),
    max_referrals: num(r.max_referrals), pool: wei(r.pool), left: wei(r.left), paid_total: wei(r.paid_total),
    returned: wei(r.returned), status: oneOf(r.status, STATUSES, "status"), referrals: num(r.referrals),
    paid: num(r.paid), opened_at: str(r.opened_at), closes_at: str(r.closes_at), closed_at: str(r.closed_at),
  };
}

export function parseReferral(v: unknown): Referral {
  const r = record(v);
  if (!r) throw new Error("referral is not an object");
  const g: Referral = {
    id: num(r.id), program: num(r.program), referrer: str(r.referrer), referred: str(r.referred),
    evidence: str(r.evidence), at: str(r.at), verdict: oneOf(r.verdict, VERDICTS, "verdict"), why: str(r.why),
    paid: wei(r.paid), reason_is_leader_supplied: Boolean(r.reason_is_leader_supplied),
  };
  // every verdict pays what the port says it pays; a not_qualifying referral pays nothing
  if (g.verdict === NOT_QUALIFYING && g.paid !== 0n) throw new Error(`a not_qualifying referral paid ${g.paid}`);
  if (g.verdict === "" && g.paid !== 0n) throw new Error(`an unjudged referral paid ${g.paid}`);
  return g;
}

// ---------------------------------------------------------------- the port

/** Python's str.split() whitespace, as far as cleaned text can contain it:
 * JavaScript's \s plus NEL (U+0085), which Python splits on and \s does not. */
const PY_WS = /[\s\u0085]+/;

/** The contract's clean_text: control characters become spaces, whitespace
 * collapses, nothing is truncated. */
export function cleanText(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const o = ch.codePointAt(0) ?? 0;
    out += o < 32 || o === 127 ? " " : ch;
  }
  return out.split(PY_WS).filter(Boolean).join(" ");
}

/** The contract's referred_key: a sha256 hex digest of the cleaned,
 * lowercased description, so the same person found with different spacing
 * or case still finds the same dedupe row. Uses the Web Crypto API, present
 * in Node 20+ and every browser. */
export async function referredKey(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(cleanText(raw).toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Python's str.strip(chars): remove any of `chars` from both ends. */
function stripChars(s: string, chars: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && chars.includes(s[a])) a++;
  while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
}

/** A model's answer as an option number 0..n-1, or "" if it is not one. */
export function normaliseChoice(raw: string, n: number): string {
  const s = stripChars(raw.trim().toLowerCase(), "[]()#").trim();
  if (s === "" || s.length > 2 || !/^[0-9]+$/.test(s)) return "";
  const k = Number(s);
  if (k < 0 || k >= n) return "";
  return String(k);
}

/** An option number, read back into its token through the order it was asked in. */
export function optionOf(choice: string, order: readonly string[]): string {
  if (choice === "") return "";
  return order[Number(choice)];
}

/** Both orders into one verdict. The same option stands; anything else is not_qualifying. */
export function fold(forward: string, reverse: string): string {
  if (forward === "" || reverse === "") return "";
  return forward === reverse ? forward : NOT_QUALIFYING;
}

/** The validator's free check: one of the two options. */
export function verdictSound(verdict: string): boolean {
  return verdict === QUALIFYING || verdict === NOT_QUALIFYING;
}
