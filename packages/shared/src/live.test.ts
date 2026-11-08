import { describe, expect, it } from "vitest";
import demo from "../../contracts/demo/demo.json";
import record from "../../contracts/deployments/studionet.json";
import shape from "../contract-shape.json";
import { parseProgram, parseReferral } from "./index";

// The live deployment's own answers, as packages/contracts/scripts/seed.mjs
// read them back from studionet. If the contract ever returned a shape these
// parsers refuse, a client built on this package would break on real data;
// this is where that shows up first.

describe("the parsers accept everything the live deployment returned", () => {
  it("the program and every referral, with exactly the fields the contract describes", () => {
    expect(Object.keys(parseProgram(record.programs[0])).sort()).toEqual(shape.views.program.fields);
    for (const x of record.referrals) {
      expect(Object.keys(parseReferral(x)).sort()).toEqual(shape.views.referrals_of.row_fields);
    }
  });

  it("the program's criteria and bonus are the ones the demo opened with", () => {
    const p = parseProgram(record.programs[0]);
    expect(p.criteria).toBe(demo.program.criteria);
    expect(p.bonus).toBe(BigInt(demo.program.bonus));
  });

  it("every qualifying referral was paid the bonus, and every not_qualifying referral nothing", () => {
    const bonus = BigInt(demo.program.bonus);
    for (const r of record.referrals.map(parseReferral)) {
      expect(r.paid).toBe(r.verdict === "qualifying" ? bonus : 0n);
    }
  });

  it("the wallets moved by exactly what the demo says they net gained", () => {
    const b = record.balances as Record<string, string>;
    for (const [who, owed] of Object.entries(record.owed)) {
      expect(BigInt(b[`${who}_after`]) - BigInt(b[`${who}_before`])).toBe(BigInt(owed));
    }
  });
});
