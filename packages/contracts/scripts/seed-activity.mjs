// A second round on the deployed contract, from two NEW wallets.
//
//   pnpm seed:activity
//
// The contract in deployments/studionet.json is not redeployed. Two wallets
// made in memory for this run, used by nothing else, run one referral from
// program to settle, and the company tries once what only a referrer may
// do:
//
//   company    registers a second program, a 0.05 GEN bonus, one referral slot
//   referrer   refers a person, with evidence they attended and gave feedback
//   company    tries to settle it before the window closes      refused
//   referrer   waits out the window, the referral was judged qualifying
//   company    settles once the window has closed: nothing left to return
//
// Everything goes to deployments/studionet-activity.json, apart from the
// demo's own record, so the demo and the tests that replay it are untouched.
// Then `pnpm evidence:activity` writes EVIDENCE-ACTIVITY.md from the chain.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createAccount, generatePrivateKey } from "genlayer-js";
import { PKG, RECORD_FILE, balanceOf, clientFor, fundAccount, loadEnv, network, readRetry, recorder, sleep } from "./lib.mjs";

loadEnv();
const net = network();
if (net.name !== "studionet") throw new Error("the activity round makes throwaway wallets; run it on studionet");
const address = JSON.parse(readFileSync(RECORD_FILE, "utf8")).contract;
const data = JSON.parse(readFileSync(path.join(PKG, "demo", "activity.json"), "utf8"));
const OUT = path.join(PKG, "deployments", "studionet-activity.json");

const company = createAccount(generatePrivateKey());
const referrer = createAccount(generatePrivateKey());
const asCompany = clientFor(net, company);
const asReferrer = clientFor(net, referrer);
const ro = clientFor(net, null);
const read = (fn, args = []) => readRetry(() => ro.readContract({ address, functionName: fn, args }));
const plain = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? Number(x) : x instanceof Map ? Object.fromEntries(x) : x)));

const id = Number(await read("count"));
console.log(`\ncontract ${address} (already deployed, ${id} programs on it)\n  company   ${company.address}\n  referrer  ${referrer.address}`);
await fundAccount(net, ro, company.address, 10n ** 18n);

const P = data.program;
const rec = recorder();
await rec.write(asCompany, company, address, "open", [P.criteria, BigInt(P.bonus), P.max_referrals, P.window],
  { step: "program 1: a new company opens a one-referral program", value: BigInt(P.bonus) * BigInt(P.max_referrals) });
const before = await balanceOf(ro, referrer.address);
await rec.write(asReferrer, referrer, address, "refer", [id, data.referred, data.evidence], { step: `referral for program ${id}: a new referrer refers (expected ${data.expected_verdict})` });
await rec.write(asCompany, company, address, "settle", [id], { step: "the company tries to settle before the window closes", expect: "refused" });

const closes = Date.parse(plain(await read("program", [id])).closes_at);
for (let left = closes + 20_000 - Date.now(); left > 0; left = closes + 20_000 - Date.now()) {
  console.log(`  waiting ${Math.ceil(left / 1000)} s for the window to close`);
  await sleep(Math.min(left, 30_000));
}
await rec.write(asCompany, company, address, "settle", [id], { step: "program 1 settled" });

const program = plain(await read("program", [id]));
let after = await balanceOf(ro, referrer.address);
const owed = program.paid === 1 ? BigInt(P.bonus) : 0n;
for (let k = 0; k < 6 && after - before !== owed; k++) {
  await sleep(10_000);
  after = await balanceOf(ro, referrer.address);
}
writeFileSync(OUT, JSON.stringify({
  network: net.name,
  contract: address,
  accounts: { company: company.address, referrer: referrer.address },
  steps: rec.steps,
  programs: { [id]: program },
  balances: { referrer_before: String(before), referrer_after: String(after) },
}, null, 2) + "\n");

console.log(`  program ${id}  ${program.status}  paid ${program.paid}/${program.max_referrals}`);
console.log(`  written  ${path.relative(PKG, OUT)}\n`);
