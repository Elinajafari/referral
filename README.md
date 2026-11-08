# Referral

**A referral bonus, paid only when GenLayer validators agree the evidence
shows a referred person met the criteria - and never twice for the same
person.** The clock settles what it can; the validators settle the one
thing it cannot.

A company opens a referral program with what makes a referral qualify, a
bonus per qualifying referral, how many referrals it will pay, and a
window, paying the bonus pool in. A referrer refers one person. GenLayer's
validators decide one thing: does the evidence show the criteria were met.
Qualifying pays the referrer at once; not qualifying pays nothing, but the
referred person is claimed either way, so nobody else can try again on
them. Once the window closes, anyone may return what is left to the
company.

**Live on studionet at [`0x887630E1404d98b89cF5858C201fe97930e9bb34`](https://explorer-studio.genlayer.com/address/0x887630E1404d98b89cF5858C201fe97930e9bb34).**
Intelligent contract + shared type layer + scripts that deploy, seed, verify
and prove it, not a standalone contract.

> Every transaction of the live demo, and the wallet that sent it, read back
> from the chain: **[EVIDENCE.md](EVIDENCE.md)** (written after `pnpm seed:contract`).
> A second round from two new wallets: **[EVIDENCE-ACTIVITY.md](EVIDENCE-ACTIVITY.md)**.

---

## Why this exists

A referral bonus is usually approved by the company that posted the
program, after the fact, from whatever the referrer says happened. "Did
this person actually sign up and pay?" is answered by the party holding the
money. Asking a model "should this referral be paid?" does not fix it: it
hands the model the money and the referrer's name at once and gets back
whatever is convenient.

### In plain terms

The company writes the criteria once, and pays every referral slot in
before the first referral. A referrer refers one person, describing who
they are and what happened since. The validators each read the criteria and
the evidence, twice, with the two options in different orders, and have to
agree exactly. If the evidence meets every condition, the referrer is paid
the bonus at once; if not, nothing is paid - but either way, that referred
person can never be referred again for a second payout, by anyone. Once the
window closes, anyone can settle the program and return what is left.

### Why this needs GenLayer specifically

Whether "created a paid account and finished onboarding within three days"
meets "a paid account and onboarding within fourteen days" is a judgment in
natural language, and the company that would keep the leftover pool is the
one party who cannot be trusted to make it. Here the reading is done by a
validator quorum, and everything that is not a judgment is kept away from
the model: the criteria were fixed before the first referral, the bonus and
the people are never shown to it, the answer is one of two options the
contract wrote, and a referred person who has already been claimed is
refused by the clock-free part of the contract, without asking anyone.

### How you actually use it

1. **Open** (the company): `open(criteria, bonus, max_referrals, window)`, paying the pool in.
2. **Refer** (a referrer): `refer(program, referred, evidence)`.
3. **Settle** (anyone, after the window): `settle(program)` returns what is left.
4. **Rely on it from another contract**: `status(program)` returns one word.

## Stack

| Layer | Tech |
|---|---|
| Contract | GenLayer Intelligent Contract, Python (GenVM): [`packages/contracts/referral.py`](packages/contracts/referral.py) |
| Consensus | custom leader/validator with `gl.vm.run_nondet_unsafe`: a free structural check, then exact agreement on qualifying or not |
| Money | `open()` is payable; every payout goes through one path, through the external message form with `value` |
| Tests | pytest on a GenVM stand-in that runs the real file, moves the chain's clock and records every transfer, plus a mutation pass that breaks every defence on purpose |
| Chain client | `genlayer-js` 1.1.8: deploy, seed, e2e, verify and evidence scripts; the StudioNet faucet funds the company |
| Types | [`packages/shared`](packages/shared): view types, parsers and a port of the contract's deterministic rules, tested against vectors generated from the contract |

---

## Quick start

```bash
pnpm install
pip install -r packages/contracts/requirements-dev.txt

pnpm test               # contract (pytest) + shared (vitest), no chain needed
```

Deploy your own copy and put the whole demo on the explorer:

```bash
pnpm deploy:contract
pnpm seed:contract      # 3 referrals, 2 qualifying, 1 not, 1 dedupe refusal, 1 leftover slot returned, 4 refusals
pnpm e2e:contract
pnpm evidence:contract
```

| Command | What it does |
|---|---|
| `pnpm test` | contract and shared suites |
| `pnpm mutate:contract` | removes every defence one at a time; every mutant must be caught by a named test |
| `pnpm measure:contract` | runs the suite and the mutation pass and renders the numbers into the contract README |
| `pnpm seed:contract` | the demo: every route and every refusal, recorded; waits on the chain's clock for the window to close |
| `pnpm seed:activity` | a second round on the deployed contract from two new wallets, recorded apart from the demo |
| `pnpm e2e:contract` | the record checked against the live chain |
| `pnpm verify:contract` | the deployed source, byte for byte against the file, and linted |
| `pnpm evidence:contract` | EVIDENCE.md: every transaction and its sender, from the chain |

On studionet nothing needs configuring: every role gets a wallet made in
memory for the run, no key is ever written to disk, and the company is
funded from the StudioNet faucet.

## The live demo

A referral program: a 0.05 GEN bonus, three referral slots, a 900-second
window. Its criteria require a paid account and onboarding completed within
fourteen days of signing up. Three referrals:

| Referrer | Who they referred | Verdict | Paid |
|---|---|---|---|
| Ann | Dana, a paid signup within three days | **qualifying** | yes |
| Cal | tried Dana again | refused - already claimed by Ann | - |
| Ben | Eli, a free trial only | **not_qualifying** | no |
| Cal | Fay, a paid signup within a week | **qualifying** | yes |

The third slot was never filled, so `settle()` returned it to the company
once the window closed. Every wallet's balance was read from the chain at
the one point each could still move - a referrer's right at the start,
the company's right before it settled - and each moved by exactly what the
demo says it net gained. Full detail, with every hash:
[EVIDENCE.md](EVIDENCE.md) and
[`packages/contracts/README.md`](packages/contracts/README.md#verified-against-the-live-deployment).

### Second round, two new wallets

`pnpm seed:activity` runs on the same contract from two wallets that have
never been used: a new company opens a one-referral workshop-attendance
program, a new referrer refers someone with evidence they attended and gave
feedback, the company tries to settle before the window closes and is
refused, and once the window closes the company settles again: nothing left
to return, the one slot having been paid. Every hash:
[EVIDENCE-ACTIVITY.md](EVIDENCE-ACTIVITY.md).

## Repo layout

```
.
├─ packages/
│  ├─ contracts/                 the Intelligent Contract and everything that proves it
│  │  ├─ referral.py             the contract
│  │  ├─ tests/                  pytest on a GenVM stand-in (see tests/README.md)
│  │  ├─ scripts/                deploy · seed · e2e · verify · evidence · lint · mutate · measure
│  │  ├─ demo/demo.json          the demo, read by the seed script AND the tests
│  │  ├─ deployments/            studionet.json, written by the scripts, never by hand
│  │  ├─ lib/                    the qualifying rules, generated from the contract
│  │  └─ DECISIONS.md            why every rule is the way it is
│  └─ shared/                    types, parsers, contract-shape.json, the rules port and its vectors
├─ EVIDENCE.md                   every live transaction and its sender
├─ EVIDENCE-ACTIVITY.md          the second round, two new wallets
└─ package.json · pnpm-workspace.yaml
```

## License

MIT © 2026 Elina ([@Elinajafari](https://github.com/Elinajafari))
