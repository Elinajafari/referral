import { describe, expect, it } from "vitest";
import vectors from "../referral-vectors.json";
import {
  FORWARD,
  REVERSED,
  cleanText,
  fold,
  normaliseChoice,
  optionOf,
  parseProgram,
  parseReferral,
  referredKey,
  verdictSound,
} from "./index";

// referral-vectors.json is generated from the contract's own functions
// (see packages/contracts/tests/test_vectors.py), so every case below is the
// contract's answer, not a hand-written expectation.

describe("the port agrees with the contract on every vector", () => {
  it.each(vectors.clean_text)("clean_text %#", ({ raw, clean }) => expect(cleanText(raw)).toBe(clean));
  it.each(vectors.referred_key)("referred_key %#", async ({ raw, key }) => expect(await referredKey(raw)).toBe(key));
  it.each(vectors.normalise_choice)("normalise_choice %#", ({ raw, n, choice }) => expect(normaliseChoice(raw, n)).toBe(choice));
  it.each(vectors.option_of)("option_of %#", ({ choice, order, option }) => expect(optionOf(choice, order)).toBe(option));
  it.each(vectors.fold)("fold %#", ({ forward, reverse, folded }) => expect(fold(forward, reverse)).toBe(folded));
  it.each(vectors.verdict_sound)("verdict_sound %#", ({ verdict, sound }) => expect(verdictSound(verdict)).toBe(sound));
});

describe("the two orders", () => {
  it("are each other's reverse", () => {
    expect([...REVERSED]).toEqual([...FORWARD].reverse());
  });
});

describe("the dedupe digest ignores case and spacing", () => {
  it("the same person, differently written, is the same key", async () => {
    expect(await referredKey("Dana Kim, dana@example.com")).toBe(await referredKey("  dana kim,   DANA@example.com  "));
  });
  it("a different person is a different key", async () => {
    expect(await referredKey("Dana Kim")).not.toBe(await referredKey("Eli Osei"));
  });
});

describe("parsers refuse what the contract never returns", () => {
  const program = {
    criteria: "Pick up litter.", company: "0x" + "11".repeat(20), bonus: "50000000000000000",
    max_referrals: 3, pool: "150000000000000000", left: "50000000000000000", paid_total: "100000000000000000",
    returned: "0", status: "open", referrals: 2, paid: 2, opened_at: "t", closes_at: "t2", closed_at: "",
  };
  const referral = {
    id: 0, program: 0, referrer: "0x" + "22".repeat(20), referred: "Dana Kim", evidence: "Dana upgraded.",
    at: "t", verdict: "qualifying", why: "", paid: "50000000000000000", reason_is_leader_supplied: true,
  };
  it("parses a program and a referral from an object or a Map, with amounts as bigint", () => {
    expect(parseProgram(program).bonus).toBe(5n * 10n ** 16n);
    expect(parseReferral(referral).paid).toBe(5n * 10n ** 16n);
    expect(parseReferral(new Map(Object.entries(referral))).verdict).toBe("qualifying");
  });
  it("refuses a status or a verdict the contract never returns", () => {
    expect(() => parseProgram({ ...program, status: "pending" })).toThrow("unexpected status");
    expect(() => parseReferral({ ...referral, verdict: "maybe" })).toThrow("unexpected verdict");
    expect(() => parseReferral({ ...referral, paid: "5e16" })).toThrow("amount of wei");
  });
  it("refuses a payout that contradicts the verdict", () => {
    expect(() => parseReferral({ ...referral, verdict: "not_qualifying", paid: "1" })).toThrow();
    expect(() => parseReferral({ ...referral, verdict: "", paid: "1" })).toThrow();
    expect(parseReferral({ ...referral, verdict: "not_qualifying", paid: "0" }).verdict).toBe("not_qualifying");
  });
});
