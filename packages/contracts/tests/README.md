# Contract tests

Referral is tested at four levels, from the cheapest to the one that costs
real transactions. Each level has one command.

| Level | Command | Needs | What it proves |
|---|---|---|---|
| 1. Offline suite | `pnpm test:contract` | Python + pytest | the contract file itself behaves as specified, including against a lying leader, a moving clock and real payouts |
| 2. Mutation pass | `pnpm mutate:contract` | same | every defence is covered by a test that fails without it |
| 3. Live demo | `pnpm deploy:contract && pnpm seed:contract` | Node 20+ | the same behaviour happens on StudioNet, with real validators, real models, real GEN and the chain's own clock |
| 4. Chain checks | `pnpm e2e:contract`, `pnpm verify:contract`, `pnpm evidence:contract` | Node 20+ | what the record claims is what the chain holds, and what is deployed is this file |

## 1. The offline suite

```bash
pip install -r requirements-dev.txt
pnpm test:contract   # from the repo root, or here: python -m pytest tests -q
```

| File | What it covers |
|---|---|
| [`test_logic.py`](test_logic.py) | the pure rules: text cleaning, the referred-person dedupe digest, reading a model's answer back through its order, the fold, the agreement, the fence and the prompt, and that `lib/referral_consensus.py` is exactly the contract's code |
| [`test_e2e.py`](test_e2e.py) | the contract executed: `open` and its bounds; `refer` (not the company, the referred-person dedupe across different referrers, every bound, the model never sees money or people, an order-dependent answer is not_qualifying, a lying or malformed leader refused, a malformed one for free, an `[LLM_ERROR]` never agreed with); `settle` on every boundary; money; and static checks over the parsed source |
| [`test_runbook.py`](test_runbook.py) | the live demo replayed offline from [`demo/demo.json`](../demo/demo.json), with the clock moved past the window, before any transaction is spent; and once `deployments/studionet.json` exists, the validators' real verdicts are replayed through this file, which must pay exactly as the deployed contract did |
| [`test_vectors.py`](test_vectors.py) | `packages/shared/referral-vectors.json` is exactly what this contract computes, so the TypeScript port is tested against the contract's own answers (`UPDATE_VECTORS=1` regenerates it) |
| [`test_shape.py`](test_shape.py) | `packages/shared/contract-shape.json` describes every public write and view, its parameters and types, and the fields the live deployment returned, exactly |

## 2. The mutation pass

```bash
pnpm mutate:contract
```

[`scripts/mutate.py`](../scripts/mutate.py) makes small edits to a copy of
the contract, each one removing a defence ("a referral is claimed twice",
"a not_qualifying referral pays the referrer", "the company may refer", "a
disagreement between the orders is qualifying", ...), runs the suite
against each, and names the test that failed. A mutant that survives is a
missing test, and the script exits non-zero.

## 3. The live demo

```bash
pnpm install
pnpm deploy:contract
pnpm seed:contract
```

Five wallets, one role each, all made in memory for the run; the company is
funded from the StudioNet faucet:

| Wallet | Does |
|---|---|
| deployer | deploys the contract, nothing else |
| company | opens the referral program, tries to refer on its own program |
| ann | refers Dana, a paid signup within three days |
| ben | refers Eli, a free trial only |
| cal | tries to refer Dana again (already claimed), then refers Fay, a paid signup within a week |
| stranger | settles too early, refers late, settles after the window |

Every transaction, in order, and what it proves. The steps are
[`demo/demo.json`](../demo/demo.json), read by the seed script and by
`test_runbook.py`.

| # | Sent by | Call | Expected | What it proves |
|---|---|---|---|---|
| 1 | company | `open` | executed | the criteria, the 0.05 GEN bonus and the window are frozen; 0.15 GEN paid in |
| 2 | company | `refer` | refused | the company cannot refer on its own program |
| 3 | ann | `refer`: Dana, a paid signup | **qualifying** | the criteria are met: paid at once |
| 4 | cal | `refer`: Dana again | refused | already claimed by Ann |
| 5 | ben | `refer`: Eli, a free trial only | **not_qualifying** | the criteria are not met: nothing paid |
| 6 | cal | `refer`: Fay, a paid signup | **qualifying** | the criteria are met: paid at once |
| 7 | stranger | `settle` | refused | referrals are open until the window closes |
| 8 | stranger | `refer` after the window closes | refused | a late referral is never judged |
| 9 | stranger | `settle` | ok | the unused third slot is returned to the company |

## 4. Checking the chain, not the record

```bash
pnpm e2e:contract
pnpm verify:contract
pnpm evidence:contract
```

`e2e` fetches every recorded transaction again and checks that the chain
still says what the record says, then re-reads the program and every
referral; nothing may still be held, and every balance must have moved by
exactly what the demo says it net gained. `verify` compares the deployed
source byte for byte with `referral.py` and lints it. `evidence` builds
[EVIDENCE.md](../../../EVIDENCE.md) from the chain's answers alone.

## Measuring

```bash
pnpm measure:contract
```

Runs the suite and the mutation pass now and renders their numbers, and the
live record, into the README. It writes nothing if the suite is red, a
mutant escapes, or the record is of a different contract file.
