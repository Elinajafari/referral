# Evidence: Referral, second round on GenLayer StudioNet

Every row below was read back from the chain by `scripts/evidence.mjs`: the
sender, the status and the outcome come from the node's answer for each hash,
not from the deployment record. Every outcome on chain matches the record.

- **Contract:** [`0x887630E1404d98b89cF5858C201fe97930e9bb34`](https://explorer-studio.genlayer.com/address/0x887630E1404d98b89cF5858C201fe97930e9bb34)
- **Round:** new wallets on the contract already deployed; no deploy in this round
- **The deployment itself:** [EVIDENCE.md](EVIDENCE.md)
- **Transactions:** 4, from 2 different wallets
- **Generated:** 2026-11-08 21:35 UTC

## Wallets

Each wallet was made in memory for this run, and its key was never written
anywhere. Click an address to see every transaction it sent.

| Role | Address | Transactions sent |
|---|---|---|
| company | [`0x7Df465EC61A760887D96bC0Dd85798Fb89356603`](https://explorer-studio.genlayer.com/address/0x7Df465EC61A760887D96bC0Dd85798Fb89356603) | 3 |
| referrer | [`0x515B1426412A7F7E4D21DDFa510928a5c985D201`](https://explorer-studio.genlayer.com/address/0x515B1426412A7F7E4D21DDFa510928a5c985D201) | 1 |

## Transactions, in order

"refused" is a transaction the contract was meant to refuse: the committee
agreed on the refusal, and the sentence is the contract's own.

| # | Step | Sent by | Method | On chain | Outcome | Tx |
|---|---|---|---|---|---|---|
| 0 | program 1: a new company opens a one-referral program | company [`0x7Df4…6603`](https://explorer-studio.genlayer.com/address/0x7Df465EC61A760887D96bC0Dd85798Fb89356603) | `open` | FINALIZED · MAJORITY_AGREE | executed | [`0x4fd98d4e…4bac`](https://explorer-studio.genlayer.com/tx/0x4fd98d4e4e37d573b01858ae18bf68bf092d78e2ed01ff67b2b1f8c7fd6e4bac) |
| 1 | referral for program 1: a new referrer refers (expected qualifying) | referrer [`0x515B…D201`](https://explorer-studio.genlayer.com/address/0x515B1426412A7F7E4D21DDFa510928a5c985D201) | `refer` | FINALIZED · MAJORITY_AGREE | executed | [`0x6c6b87d8…3a13`](https://explorer-studio.genlayer.com/tx/0x6c6b87d80ca64a76b4943b34ae5997e1a4e0fbc049011bc21d74b292317b3a13) |
| 2 | the company tries to settle before the window closes | company [`0x7Df4…6603`](https://explorer-studio.genlayer.com/address/0x7Df465EC61A760887D96bC0Dd85798Fb89356603) | `settle` | FINALIZED · MAJORITY_AGREE | refused: referrals are open until 2026-11-08T21:34:50Z | [`0xfbbb0937…b55f`](https://explorer-studio.genlayer.com/tx/0xfbbb0937822d5ac53e656a6a9063dc51c896d7c8e244e5a5113b59c69693b55f) |
| 3 | program 1 settled | company [`0x7Df4…6603`](https://explorer-studio.genlayer.com/address/0x7Df465EC61A760887D96bC0Dd85798Fb89356603) | `settle` | ACCEPTED · MAJORITY_AGREE | executed | [`0x0e9a2eb7…497d`](https://explorer-studio.genlayer.com/tx/0x0e9a2eb7d78339f447579d8cebbc7ad45138781a2823bae0bdd92ad7e41d497d) |
