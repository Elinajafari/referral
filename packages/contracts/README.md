# Referral - GenLayer Intelligent Contract

[`referral.py`](./referral.py) is the whole protocol: a company opens a
referral program with its criteria, a bonus per qualifying referral, how
many referrals it will pay and a window, and pays bonus x referrals in. A
referrer refers one person, describing who they are and the evidence that
they did what the criteria require; validators decide in the same call, in
two orders, whether the evidence shows the criteria were met. A qualifying
referral is paid at once. A referred person, once claimed - by that
referrer or any other - can never be claimed again, so two referrers cannot
both collect on the same signup. Once the window closes, anyone may return
what is left to the company.

## Core rule

```
the criteria, the bonus and the window are frozen at open(), before the first referral
a referral is judged against two options the contract wrote: qualifying or not_qualifying; the model never sees money or people
qualifying pays the referrer the bonus at once; not_qualifying pays nothing, but the referred person stays claimed either way
a referred person, once claimed, is refused for free on every further referral, by any referrer
a referral after the window closes is refused before any model: a late referral is never judged
once the window closes, anyone may settle: whatever is left goes back to the company
```

## Lifecycle

```
company:   open(criteria, bonus, max_referrals, window)   bonus x max_referrals paid in, everything frozen
referrer:  refer(program, referred, evidence)              [validators, both orders] -> qualifying: paid the bonus at once
                                                                                         not_qualifying: nothing paid, the referred person stays claimed
                                                             the same referred person again: refused before any model
anyone:    settle(program)                                 after the window -> whatever is left goes to the company
anyone:    count, held_total, status, program, referrals_of, claimed_on
```

Judgment fails **closed**: an unusable model answer is retried once inside
the block and then raised as `[LLM_ERROR]`, which no validator agrees with.
It never moves money. Every waiting state has a clock, and every clock ends
in the pool being settled.

## Deploy

```bash
pnpm install                          # from the repo root
pnpm deploy:contract                  # studionet, a deployer key made for this run
pnpm seed:contract                    # the demo, recorded in deployments/studionet.json
pnpm e2e:contract                     # the record checked against the chain
pnpm verify:contract                  # deployed source == referral.py, and genvm-lint on it
pnpm evidence:contract                # EVIDENCE.md at the repo root, from the chain
```

Every script reads a transaction's outcome from the leader's result
(`return` or `rollback`), never from `ACCEPTED` alone: the committee accepts
a refusal too. Sends are nonce-guarded, and a send whose answer was lost is
found again in StudioNet's own index rather than sent twice. On studionet
the company is funded from the StudioNet faucet, and the payouts are checked
by reading every wallet's balance from the chain at the one point each can
still move: a referrer's, right at the start (they are paid, or not, inside
their own single referral); the company's, right before it settles. Why
each rule is the way it is: [DECISIONS.md](DECISIONS.md).

## Surface

| Write | Caller | Why |
|---|---|---|
| `open(criteria, bonus, max_referrals, window)` *payable* | anyone, paying bonus x max_referrals | the caller becomes the company |
| `refer(program, referred, evidence)` | anyone but the company | only a referrer can say who they referred and what happened |
| `settle(program)` | anyone, deliberately, after the window | it reads no model and returns only what the clock already says is left |

| View | Returns |
|---|---|
| `count()` | number of programs |
| `held_total()` | wei held for open programs |
| `status(program)` | `open` or `closed`: one word for another contract |
| `program(id)` | the frozen criteria, bonus and clock, and how many referrals it has taken |
| `referrals_of(program)` | every referral, its verdict, its payment, and the leader's own reason (not consensus) |
| `claimed_on(program, referred)` | the referral id already claimed for this referred person, or -1 |

## Threat model

| Attack | What stops it |
|---|---|
| Criteria edited after a referral | they are frozen at `open()`, before the first referral |
| The model deciding who deserves the money | it never sees the bonus, the referrer or the company, and only picks one of two options the contract wrote |
| A referral that is only qualifying when "qualifying" is listed first | both orders inside one block; a difference is `not_qualifying` |
| Two referrers both claiming the same signup | the referred person is claimed on the first referral, whatever the verdict, by a digest of their cleaned description |
| The company referring on its own program | `refer()` refuses the company's own address, before any model |
| A referral after the window closes | refused before any model: a late referral is never judged |
| A program that never pays out its pool | anyone may `settle()` once the window closes |
| A broken model moves money by failing | an unusable answer is retried once, then raised as `[LLM_ERROR]` |
| Prompt injection inside criteria, a referred person's description or the evidence | `fence()` replaces `< > [ ]` at the prompt boundary and the contract numbers the options itself |

## Tests

The suite runs on [`tests/glsim.py`](tests/glsim.py), a small GenVM stand-in
that executes the real contract file, gives the leader and the validator
their own mock answers, can make a leader lie, sets the chain's clock,
carries the value a call sends and the transfers it makes, and refuses what
GenVM refuses. What each file covers, and what every demo transaction
proves, is in [tests/README.md](tests/README.md).

<!-- measured:tests:start -->
Measured: **143 passed**, 0 skipped, including the checks of the live record in `deployments/studionet.json`, which run once `pnpm seed:contract` has written it. The same record is checked against the chain itself by `pnpm e2e:contract`.
<!-- measured:tests:end -->

**The tests have teeth.** [`scripts/mutate.py`](scripts/mutate.py) removes every
defence one at a time and names the test that caught each mutant. It refuses to
run on a red baseline and exits non-zero if anything escapes.

<!-- measured:mutations:start -->
Measured: **57 mutations, 57 caught, 0 escaped.**

| Mutation | Caught by |
|---|---|
| the company may refer | `test_the_company_cannot_refer_on_its_own_program` |
| a referral is claimed twice | `test_the_same_referred_person_cannot_be_claimed_twice` |
| a closed program takes a referral | `test_a_closed_program_takes_no_referral` |
| a closed program settles again | `test_a_program_settles_once` |
| referrals never close | `test_referrals_close_on_the_clock` |
| referrals close a second early | `test_referrals_close_on_the_clock` |
| settle runs before the window closes | `test_nothing_settles_while_referrals_are_open` |
| settle closes a second early | `test_nothing_settles_while_referrals_are_open` |
| criteria of any length are accepted | `test_criteria_are_bounded` |
| a bonus of zero is accepted | `test_the_bonus_is_bounded` |
| a program pays any number of referrals | `test_the_number_of_referrals_is_bounded` |
| the window is unbounded | `test_the_window_is_bounded` |
| the window does not set the clock | `test_a_program_opens_with_its_criteria_frozen_and_every_bonus_paid_in` |
| any payment is accepted at open | `test_bonus_times_referrals_is_paid_in_exactly` |
| a referred description of any length is accepted | `test_the_referred_description_length_bounds` |
| evidence of any length is accepted | `test_the_evidence_length_bounds` |
| referrals continue past every paid bonus | `test_referrals_stop_when_every_bonus_is_paid` |
| a program takes any number of referrals | `test_a_program_takes_a_bounded_number_of_referrals` |
| control characters are stored | `test_clean_text_collapses_whitespace_and_control_characters` |
| a not_qualifying referral pays the referrer | `test_a_referral_that_does_not_show_the_criteria_were_met_is_recorded_and_paid_nothing` |
| a qualifying referral pays nothing | `test_a_qualifying_referral_is_paid_at_once` |
| the paid count is not kept | `test_a_qualifying_referral_is_paid_at_once` |
| the paid total is not kept | `test_a_qualifying_referral_is_paid_at_once` |
| the pool is not drawn down on a payout | `test_a_qualifying_referral_is_paid_at_once` |
| a referred person is not remembered as claimed | `test_the_same_referred_person_cannot_be_claimed_twice` |
| a leader's reason is stored as sent | `test_the_reason_is_not_compared_and_is_stored_sanitised` |
| a leader's reason is stored uncapped | `test_the_reason_is_not_compared_and_is_stored_sanitised` |
| referrals are not linked | `test_every_persistent_field_is_declared_and_every_stored_field_is_read` |
| the referral count is not kept | `test_a_qualifying_referral_is_paid_at_once` |
| the rest is not returned | `test_settle_returns_what_is_left_to_the_company` |
| what was returned is not recorded | `test_settle_returns_what_is_left_to_the_company` |
| the held counter is not raised | `test_a_program_opens_with_its_criteria_frozen_and_every_bonus_paid_in` |
| a payout beyond what is held is sent | `test_a_payout_beyond_what_is_held_is_refused` |
| the held counter is not lowered | `test_a_qualifying_referral_is_paid_at_once` |
| the second pass is asked in the forward order | `test_the_options_are_asked_in_both_orders` |
| the reversed order is not reversed | `test_the_options_are_asked_in_both_orders` |
| a disagreement between the orders keeps the forward verdict | `test_a_model_that_always_answers_0_pays_nothing` |
| a disagreement between the orders is qualifying | `test_a_model_that_always_answers_0_pays_nothing` |
| an answer is not read back through its order | `test_a_qualifying_referral_is_paid_at_once` |
| an option past the list is accepted | `test_an_unusable_answer_is_an_error_and_never_a_verdict` |
| an answer in words is read as a number | `test_an_unusable_answer_is_an_error_and_never_a_verdict` |
| an unusable answer is not retried | `test_an_unusable_answer_is_an_error_and_never_a_verdict` |
| a bare value is read as if it were an object | `test_an_unusable_answer_is_an_error_and_never_a_verdict` |
| an unusable answer becomes qualifying | `test_an_unusable_answer_is_an_error_and_never_a_verdict` |
| the validator agrees with a leader error | `test_an_unusable_answer_is_an_error_and_never_a_verdict` |
| the validator skips the free structural check | `test_a_verdict_that_is_neither_option_is_refused_for_free` |
| the validator agrees with anything | `test_nodes_that_decide_differently_do_not_agree` |
| the validator agrees when its own model fails | `test_a_validator_whose_model_fails_does_not_agree` |
| agreement ignores the structural check | `test_an_unsound_verdict_does_not_agree_with_itself` |
| any word is a sound verdict | `test_a_verdict_that_is_neither_option_is_refused_for_free` |
| the agreed verdict is not checked again | `test_the_agreed_verdict_is_checked_again_before_it_is_stored` |
| the fence does nothing | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the fence leaves square brackets | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the evidence reaches the prompt unfenced | `test_every_value_interpolated_into_the_prompt_is_fenced_or_ours` |
| the referred person reaches the prompt unfenced | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the criteria reach the prompt unfenced | `test_caller_text_is_stored_verbatim_and_fenced_only_at_the_prompt` |
| the prompt judges effort instead of the evidence | `test_the_prompt_tells_the_model_not_to_judge_effort` |
<!-- measured:mutations:end -->

## Verified against the live deployment

<!-- measured:deployment:start -->
Deployed on studionet at [`0x887630E1404d98b89cF5858C201fe97930e9bb34`](https://explorer-studio.genlayer.com/address/0x887630E1404d98b89cF5858C201fe97930e9bb34) (deploy [`0x5a1183d9...`](https://explorer-studio.genlayer.com/tx/0x5a1183d90481c58fef273b0f28d333ad691e209c383ef60c9716c6ef27f0ecb2)). Every value below was read back from the chain by `scripts/seed.mjs` and written to [`deployments/studionet.json`](deployments/studionet.json); none of it is typed by hand.

The program: a bonus of 0.05 GEN per qualifying referral, 3 referral slots. Its criteria, frozen at open(): *A referral qualifies only if the evidence shows the referred person created a paid account and completed onboarding within fourteen days of signing up. Signing up for a free trial without upgrading, or evidence about a different product, is not enough.*

| Referral | Referred | Verdict | Paid | Reason the leader gave (not consensus) |
|---|---|---|---|---|
| 0 | Dana Kim, dana@example.com, signed up this month | **qualifying** | 0.05 GEN | Evidence shows a paid account was created and onboarding completed within three days of signup, meeting both criteria. |
| 1 | Eli Osei, eli@example.com, signed up this month | **not_qualifying** | 0 GEN | Evidence shows only a free trial signup with no paid upgrade, so the paid account criterion is not met. |
| 2 | Fay Novak, fay@example.com, signed up this month | **qualifying** | 0.05 GEN | Evidence states Fay upgraded to a paid account and completed onboarding within a week of signing up, satisfying both required conditions. |

Every wallet's balance was read from the chain before and again once every payout had landed, against what the demo says it net gained:

| Wallet | Before | After | Net owed |
|---|---|---|---|
| company | 0.85 GEN | 0.9 GEN | 0.05 GEN |
| ann | 0 GEN | 0.05 GEN | 0.05 GEN |
| ben | 0 GEN | 0 GEN | 0 GEN |
| cal | 0 GEN | 0.05 GEN | 0.05 GEN |

Every transaction, in order, refusals included, with the wallet that sent it:

| Step | From | Outcome | Transaction |
|---|---|---|---|
| program 0: a 0.05 GEN bonus, up to three referrals | company | ok | [`0x4ac8f159...`](https://explorer-studio.genlayer.com/tx/0x4ac8f1597533db87ac43c5608e6e23dfcc74c112f67eb341f54312e6f1bdbec0) |
| the company refers on its own program | company | refused: the company cannot refer on its own program | [`0x0d3d2b67...`](https://explorer-studio.genlayer.com/tx/0x0d3d2b67741c8719962535dbf1c2e361400d69d5a01116491fb921cd2d4ce10d) |
| referral 0: Ann refers Dana, a paid signup within three days | ann | ok | [`0x5cac148a...`](https://explorer-studio.genlayer.com/tx/0x5cac148a26249894b74f946f064ae059806fdd6726664ec228ba0d5af777c0a1) |
| referral 1: Ben refers Eli, a free trial only | ben | ok | [`0x111a36fe...`](https://explorer-studio.genlayer.com/tx/0x111a36febdb02cfcd1d1d8cd6308f95479ecc2990990c9b3d08f5f83bd2f8979) |
| Cal tries to refer Dana, already claimed by Ann | cal | refused: this referred person has already been claimed | [`0x7229cb70...`](https://explorer-studio.genlayer.com/tx/0x7229cb70dabe36b2e418dc9a72389ce204783d9b38e338656040d4653e12106e) |
| referral 2: Cal refers Fay, a paid signup within a week | cal | ok | [`0x29676f7c...`](https://explorer-studio.genlayer.com/tx/0x29676f7ce1b06faccb0500c9a6f4a4706f4f979c7ea3af9ecb53b39f55732e79) |
| a settlement before the window closes | stranger | refused: referrals are open until 2026-11-08T21:23:58Z | [`0x68811148...`](https://explorer-studio.genlayer.com/tx/0x688111482964247d215c94ab89d26271e14f546d3e126bbb4f3eee7e4d4352e5) |
| a late referral after the window closes | stranger | refused: referrals closed at 2026-11-08T21:23:58Z; a late referral is never judged | [`0xc7d25e90...`](https://explorer-studio.genlayer.com/tx/0xc7d25e907e089e90c789ac286019999b3975eb48ab770f5100f60fd1148ef60f) |
| program 0 settled: the unused third slot returned | stranger | ok | [`0xedc3df7e...`](https://explorer-studio.genlayer.com/tx/0xedc3df7e1379acda19fe8483b8c2e2e4735274b5960b80e677759f83c08038f3) |

`tests/test_runbook.py::TestTheRecord` replays these verdicts through this repository's contract and fails unless it pays exactly as the deployed one did, and unless every wallet's balance moved on chain by exactly what the demo says it net gained.
<!-- measured:deployment:end -->

On top of the record: `pnpm e2e:contract` asks the chain again for every
transaction, the program and every referral and checks each against the
record, along with every wallet's balance, and `pnpm verify:contract` reads
the deployed source back with `gen_getContractCode`, compares it byte for
byte with `packages/contracts/referral.py`, and runs genvm-lint on the
deployed bytes.

## Known limits

- Validators judge what the evidence describes, not whether it is true; the evidence is public and permanent next to the payment.
- A referred person described differently each time is a new dedupe row; the claim only catches the exact cleaned description claimed before.
- One bonus per referral, the native token only, whole wei.
- StudioNet is a test network; its state can be reset.

## Path forward

- A signed attestation from the referred person themselves, read by the same model alongside the referrer's evidence.
- A tiered bonus: a larger payout for a referral that stays active past a second window, by the clock alone.
- A referral board that shows each program's remaining slots and window.
