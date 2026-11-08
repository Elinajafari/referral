# DECISIONS

Why Referral is built the way it is. Each section names the alternative that
was rejected and what it would have cost.

## The model decides whether the criteria were met, never the money

The obvious design asks a model "should this referral be paid?". It hands
the model the bonus, the referrer and the company's reputation, and gets
back a judgment about generosity. So the model answers one question: does
the evidence show the referred person did what the criteria require. It
never sees the bonus, the referrer, or how many were already paid. The
payment is fixed in advance.
`tests/test_e2e.py::TestStorageShape::test_the_block_never_touches_storage_and_never_sees_money_or_the_referrer`
fails if any of them is passed into the block, and
`test_the_model_is_never_shown_the_bonus_or_the_referrer` checks every
prompt of a real referral.

## The criteria and the money exist before the first referral

The criteria, the bonus, the number of referrals and the window are frozen
at `open()`, and bonus x referrals is paid in exactly. Criteria loosened
after a referral arrived could be loosened to pay it, or tightened to
refuse it.

## Two options the contract wrote

The answer is `qualifying` or `not_qualifying`, labelled `[0]` and `[1]` by
the contract inside an `<options>` block, after every caller string has
been fenced. A referral cannot forge a third option or close its block.

## Order-dependence does not qualify

The options are asked in the order qualifying, not_qualifying and then
reversed and renumbered; each answer is read back through the order it was
asked in. The same option both ways stands; anything else is
`not_qualifying`. A referral that only qualifies when "qualifying" is
listed first does not clearly meet the criteria, and the referrer carries
the burden of showing that it does.

## A referred person, once claimed, stays claimed

`referred_key()` digests the cleaned, lowercased description of the
referred person and keys a `"program:digest"` row, claimed on the first
referral of that person whatever the verdict. The same person referred
again - by the same or a different referrer - is refused for free. This is
the deliberate point of the design: two referrers cannot both collect for
bringing in the same signup, and a company cannot be charged twice for one
person. It is not proof against a lightly reworded description of the same
person, and that is a known limit.

## Judged in the call that refers

There is no separate "rule" step. The referrer who refers is the one who
wants the answer and is paid in the same transaction. A failed judgment
rolls the whole call back, so it never uses up a referral or claims the
referred person.

## Every judgment has a clock

The window is frozen at `open()`. After `closes_at`, `refer()` refuses
before any model is asked, and `settle()` returns what is left. A company
cannot keep a program open to wait out referrals, and nobody can spend
inference on a program that can no longer pay.

## Settled before the model

Everything an answer could not change is refused for free, before a
prompt: a referral after the window closed, a referral from the company, a
referred person already claimed, and a referral once every bonus is paid.

## Money

The pool is paid in at `open()` and counted in `held`. Every payout goes
through one guarded path, after the state that justifies it is written,
and a payout larger than `held` is refused. `refer()` is not payable: the
referrer risks nothing but their own time describing the referral.

## Tagging untrusted text is not a fence

The criteria, the referred person's description and the evidence are
written by someone with a stake. `fence()` replaces `< > [ ]` at the prompt
boundary, length preserved. Stored text is kept verbatim; only the prompt
is fenced.

## The reason string is leader-supplied

`because` is stored next to each referral, sanitised and capped at 140
characters, and is not part of consensus. Nothing in the contract acts on
it, and the view says so.

## Known limits

- The model judges what the evidence describes, not the actual signup; the evidence is public and permanent next to any payment.
- A referred person described differently each time (a nickname, a different email) is a new dedupe row; the claim only catches the exact cleaned description claimed before.
- On StudioNet a payment can land a little after the transaction that sent it, so `scripts/seed.mjs` reads each wallet until what the contract sent has arrived.
- StudioNet is a test network; its state can be reset.

## A company both pays in and may be refunded

The company pays the pool in at `open()` and may later receive some of it
back at `settle()`. `scripts/seed.mjs` reads the company's balance right
before the settle step specifically, after every referral has already
landed either way, so that one snapshot is guaranteed to be *before* the
one payout the company can still receive. A referrer's own balance is read
at the very start, before any referral at all, since a referrer is paid (or
not) inside their own single `refer()` call and never again.
`tests/test_runbook.py` checks this balance identity against the chain.

## Why the tests are built the way they are

- **Each node gets its own answers**, so a contract that assumes both nodes read the same thing is caught offline.
- **A leader can lie**, so the validator's checks are reachable, and the free layer is measured: a verdict that is neither option must cost the validator zero prompts, and the free refusals before the block must cost everyone zero prompts.
- **Every transfer is recorded**, so a payment sent to the wrong wallet fails a test.
- **The runbook is a test.** The demo is replayed offline from `demo/demo.json` before a transaction is spent, and once `deployments/studionet.json` exists the validators' real verdicts are replayed through this file, and every wallet's balance on chain is checked against the net amount the demo says it gained.
- **The port is tested against the contract.** `packages/shared/referral-vectors.json` is generated from the contract's own functions.
- **Mutation testing.** `scripts/mutate.py` removes each defence and names the test that caught it.

## GenVM constraints this contract obeys

- the runner is pinned (`py-genlayer:1jb45aa8...`), never `test` or `latest`
- the class is named after the product, because `genvm-lint validate` does not see a class named `Contract`; the storage rows are `Program` and `Lead`, so no dataclass shares the contract's own class name
- no `int`, `list`, `dict` or `tuple` as a storage type, and no collection inside a storage dataclass; TreeMap keys are strings
- every persistent field is declared in the class body, and every stored field is read somewhere
- the block returns a flat dict of strings
- `gl.nondet` is reached only from `ask`, called only from inside the block
- payouts use `@gl.evm.contract_interface` and `emit_transfer(value=...)`
- the file is pure ASCII
- `genvm-lint` validates against GenVM `v0.3.0-rc7`, the release that ships the pinned runner; `scripts/verify.mjs` sets `GENVM_VERSION` accordingly

## Not upgradable

There is no owner and no admin method. A program's criteria, bonus and
window are frozen at `open()`, and a verdict on record stays the verdict.
