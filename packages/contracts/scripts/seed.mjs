// Put the demo on the explorer: every route the contract has, refusals included.
//
//   pnpm seed:contract
//
// Reads the address from deployments/studionet.json (written by deploy.mjs)
// and sends the steps in demo/demo.json, in order: the company opens a
// program with its criteria, three referrers refer three people, two
// qualify and are paid at once, one does not qualify and is paid nothing,
// a second referrer trying the already-claimed person is refused, a
// settlement before the window closes is refused, a late referral after the
// window closes is refused, and the settlement returns the unused third
// slot. Everything is appended to the same record: each transaction hash
// and its sender, its status, the refusal sentence where there was one, the
// program and every referral as the chain holds them, and every wallet's
// balance read from the chain after the bonus pool was paid in and once
// every payout had landed. Nothing in that file is typed by hand.
//
// Five wallets act, each in one role: the company, three referrers (Ann,
// Ben and Cal) and a stranger. They come from <ROLE>_PRIVATE_KEY, or on
// studionet are made in memory for this run and never written to disk; the
// company is funded from the StudioNet faucet. The run stops at the first
// step that does not do what the demo expects, because the record claims
// whatever it holds.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PKG, RECORD_FILE, accountFrom, balanceOf, clientFor, fundAccount, loadEnv, network, readRetry, recorder, sleep, sourceSha256 } from "./lib.mjs";

loadEnv();
const net = network();
const record = JSON.parse(readFileSync(RECORD_FILE, "utf8"));
if (record.source_sha256 !== sourceSha256()) {
  throw new Error("referral.py has changed since it was deployed; run pnpm deploy:contract first");
}
const address = record.contract;
const demo = JSON.parse(readFileSync(path.join(PKG, "demo", "demo.json"), "utf8"));
const GEN = 10n ** 18n;

const ROLES = ["company", "ann", "ben", "cal", "stranger"];
const who = Object.fromEntries(ROLES.map((k) => [k, accountFrom(`${k.toUpperCase()}_PRIVATE_KEY`, net)]));
const as = Object.fromEntries(ROLES.map((k) => [k, clientFor(net, who[k])]));
const ro = clientFor(net, null);
console.log(`\ncontract ${address}`);
for (const k of ROLES) console.log(`  ${k.padEnd(10)} ${who[k].address}`);

const rec = recorder();
const read = (fn, args = []) => readRetry(() => ro.readContract({ address, functionName: fn, args }));
const plain = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? Number(x) : x instanceof Map ? Object.fromEntries(x) : x)));

const existing = Number(await read("count"));
if (existing !== 0) throw new Error(`the demo expects a fresh contract; this one already has ${existing} programs`);

if (net.name === "studionet") {
  console.log("\nfunding the company from the StudioNet faucet");
  await fundAccount(net, ro, who.company.address, GEN);
}

const PAID = ["company", "ann", "ben", "cal"];
const balanceOfOne = (k) => balanceOf(ro, who[k].address);
const expected = [...demo.expected_verdicts];
const P = demo.program;
// ann, ben and cal are each paid (or not) during their OWN refer() call, so
// their balance is read before any step at all: a referral's payout, if any,
// happens no later than that same call. company is both the payer (at open)
// and the eventual payee (at settle), so its own "before" is read right
// before the settle step, after every referral has already landed either way.
const before = {};
for (const k of ["ann", "ben", "cal"]) before[k] = await balanceOfOne(k);

console.log("\nthe demo");
for (const [i, step] of demo.steps.entries()) {
  if (step.after) {
    const [field, k] = step.after;
    const when = Date.parse(plain(await read("program", [k]))[field]);
    for (let left = when + 20_000 - Date.now(); left > 0; left = when + 20_000 - Date.now()) {
      console.log(`  waiting ${Math.ceil(left / 1000)} s for program ${k}'s ${field.replace("_", " ")}`);
      await sleep(Math.min(left, 30_000));
    }
  }
  let args = [step.id];
  let value = 0n;
  if (step.method === "open") {
    args = [P.criteria, BigInt(P.bonus), P.max_referrals, P.window];
    value = BigInt(P.bonus) * BigInt(P.max_referrals);
  } else if (step.method === "refer") {
    args = [step.id, demo.referred[step.referred], demo.evidence[step.evidence]];
  }
  if (step.method === "settle" && step.expect === "ok") before.company = await balanceOfOne("company");
  await rec.write(as[step.who], who[step.who], address, step.method, args, { step: step.step, expect: step.expect, value });
  // A verdict must come back as the demo expects, or every step after it
  // would be recorded against the wrong story: stop here instead.
  if (step.method === "refer" && step.expect === "ok") {
    const rows = plain(await read("referrals_of", [step.id])).referrals;
    const got = rows[rows.length - 1];
    if (got.verdict === "qualifying" || got.verdict === "not_qualifying") {
      const want = expected.shift();
      console.log(`      ruled ${got.verdict}: ${got.why}`);
      if (got.verdict !== want) throw new Error(`referral ${got.id} was ruled ${got.verdict}, the demo expects ${want}`);
    }
  }
}

const n = Number(await read("count"));
const programs = [];
for (let k = 0; k < n; k++) programs.push(plain(await read("program", [k])));
const referralsOf0 = plain(await read("referrals_of", [0])).referrals;
const owed = Object.fromEntries(PAID.map((p) => [p, 0n]));
const name = Object.fromEntries(PAID.map((p) => [who[p].address.toLowerCase(), p]));
for (const r of referralsOf0) if (name[r.referrer.toLowerCase()]) owed[name[r.referrer.toLowerCase()]] += BigInt(r.paid);
owed.company += BigInt(programs[0].returned);
// a payout is a message the chain delivers after the transaction; wait until every one has landed
const readAllBalances = async () => Object.fromEntries(await Promise.all(PAID.map(async (k) => [k, await balanceOfOne(k)])));
let after = await readAllBalances();
for (let k = 0; k < 12 && PAID.some((p) => after[p] - before[p] !== owed[p]); k++) {
  await sleep(10_000);
  after = await readAllBalances();
}
const out = {
  ...record,
  accounts: { deployer: record.deployer, ...Object.fromEntries(ROLES.map((k) => [k, who[k].address])) },
  steps: [...record.steps.filter((st) => st.step === "deploy"), ...rec.steps],
  programs,
  referrals: referralsOf0,
  balances: Object.fromEntries(PAID.flatMap((p) => [[`${p}_before`, String(before[p])], [`${p}_after`, String(after[p])]])),
  owed: Object.fromEntries(PAID.map((p) => [p, String(owed[p])])),
  held_after: String(await read("held_total")),
};
writeFileSync(RECORD_FILE, JSON.stringify(out, null, 2) + "\n");

const gen = (wei) => `${Number(BigInt(wei)) / 1e18} GEN`;
console.log("");
for (const r of referralsOf0) console.log(`  referral ${r.id}  ${r.verdict.padEnd(14)} paid ${gen(r.paid)}`);
for (const p of PAID) console.log(`  ${p.padEnd(10)} ${gen(before[p])} -> ${gen(after[p])}  (owed ${gen(owed[p])})`);
console.log(`  written  ${path.relative(PKG, RECORD_FILE)}\n`);
