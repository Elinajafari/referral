# Evidence: Referral on GenLayer StudioNet

Every row below was read back from the chain by `scripts/evidence.mjs`: the
sender, the status and the outcome come from the node's answer for each hash,
not from the deployment record. Every outcome on chain matches the record.

- **Contract:** [`0x887630E1404d98b89cF5858C201fe97930e9bb34`](https://explorer-studio.genlayer.com/address/0x887630E1404d98b89cF5858C201fe97930e9bb34)
- **Deploy transaction:** [`0x5a1183d9…ecb2`](https://explorer-studio.genlayer.com/tx/0x5a1183d90481c58fef273b0f28d333ad691e209c383ef60c9716c6ef27f0ecb2)
- **Source sha256:** `efa20a8c8bdc728aed5a77dec3212120a3a2255c0ee3d7431cabe20427fb7034`
- **Transactions:** 10, from 6 different wallets
- **Generated:** 2026-11-08 21:26 UTC

## Wallets

Each wallet was made in memory for this run, and its key was never written
anywhere. Click an address to see every transaction it sent.

| Role | Address | Transactions sent |
|---|---|---|
| deployer | [`0x396cE6B624FB912Ce58dc35BC17480eF2A381206`](https://explorer-studio.genlayer.com/address/0x396cE6B624FB912Ce58dc35BC17480eF2A381206) | 1 |
| company | [`0xc985F66Ff901357a61Afd88fDce7c73C2d4abFCE`](https://explorer-studio.genlayer.com/address/0xc985F66Ff901357a61Afd88fDce7c73C2d4abFCE) | 2 |
| ann | [`0x4F550476519933911fA206809600c81F538a94Cf`](https://explorer-studio.genlayer.com/address/0x4F550476519933911fA206809600c81F538a94Cf) | 1 |
| ben | [`0x18f32A3300912C41F09cF5038Ff8e825Dc9d402C`](https://explorer-studio.genlayer.com/address/0x18f32A3300912C41F09cF5038Ff8e825Dc9d402C) | 1 |
| cal | [`0x931a7042f45Ff50c3d62F2fd4EC22aE61752Deab`](https://explorer-studio.genlayer.com/address/0x931a7042f45Ff50c3d62F2fd4EC22aE61752Deab) | 2 |
| stranger | [`0x7aD34fEF06004a0272bB1C9c5e7B611a2Af6f991`](https://explorer-studio.genlayer.com/address/0x7aD34fEF06004a0272bB1C9c5e7B611a2Af6f991) | 3 |

## Transactions, in order

"refused" is a transaction the contract was meant to refuse: the committee
agreed on the refusal, and the sentence is the contract's own.

| # | Step | Sent by | Method | On chain | Outcome | Tx |
|---|---|---|---|---|---|---|
| 0 | deploy | deployer [`0x396c…1206`](https://explorer-studio.genlayer.com/address/0x396cE6B624FB912Ce58dc35BC17480eF2A381206) | `deploy` | FINALIZED · MAJORITY_AGREE | executed | [`0x5a1183d9…ecb2`](https://explorer-studio.genlayer.com/tx/0x5a1183d90481c58fef273b0f28d333ad691e209c383ef60c9716c6ef27f0ecb2) |
| 1 | program 0: a 0.05 GEN bonus, up to three referrals | company [`0xc985…bFCE`](https://explorer-studio.genlayer.com/address/0xc985F66Ff901357a61Afd88fDce7c73C2d4abFCE) | `open` | FINALIZED · MAJORITY_AGREE | executed | [`0x4ac8f159…bec0`](https://explorer-studio.genlayer.com/tx/0x4ac8f1597533db87ac43c5608e6e23dfcc74c112f67eb341f54312e6f1bdbec0) |
| 2 | the company refers on its own program | company [`0xc985…bFCE`](https://explorer-studio.genlayer.com/address/0xc985F66Ff901357a61Afd88fDce7c73C2d4abFCE) | `refer` | FINALIZED · MAJORITY_AGREE | refused: the company cannot refer on its own program | [`0x0d3d2b67…e10d`](https://explorer-studio.genlayer.com/tx/0x0d3d2b67741c8719962535dbf1c2e361400d69d5a01116491fb921cd2d4ce10d) |
| 3 | referral 0: Ann refers Dana, a paid signup within three days | ann [`0x4F55…94Cf`](https://explorer-studio.genlayer.com/address/0x4F550476519933911fA206809600c81F538a94Cf) | `refer` | FINALIZED · MAJORITY_AGREE | executed | [`0x5cac148a…c0a1`](https://explorer-studio.genlayer.com/tx/0x5cac148a26249894b74f946f064ae059806fdd6726664ec228ba0d5af777c0a1) |
| 4 | referral 1: Ben refers Eli, a free trial only | ben [`0x18f3…402C`](https://explorer-studio.genlayer.com/address/0x18f32A3300912C41F09cF5038Ff8e825Dc9d402C) | `refer` | FINALIZED · MAJORITY_AGREE | executed | [`0x111a36fe…8979`](https://explorer-studio.genlayer.com/tx/0x111a36febdb02cfcd1d1d8cd6308f95479ecc2990990c9b3d08f5f83bd2f8979) |
| 5 | Cal tries to refer Dana, already claimed by Ann | cal [`0x931a…Deab`](https://explorer-studio.genlayer.com/address/0x931a7042f45Ff50c3d62F2fd4EC22aE61752Deab) | `refer` | FINALIZED · MAJORITY_AGREE | refused: this referred person has already been claimed | [`0x7229cb70…106e`](https://explorer-studio.genlayer.com/tx/0x7229cb70dabe36b2e418dc9a72389ce204783d9b38e338656040d4653e12106e) |
| 6 | referral 2: Cal refers Fay, a paid signup within a week | cal [`0x931a…Deab`](https://explorer-studio.genlayer.com/address/0x931a7042f45Ff50c3d62F2fd4EC22aE61752Deab) | `refer` | FINALIZED · MAJORITY_AGREE | executed | [`0x29676f7c…2e79`](https://explorer-studio.genlayer.com/tx/0x29676f7ce1b06faccb0500c9a6f4a4706f4f979c7ea3af9ecb53b39f55732e79) |
| 7 | a settlement before the window closes | stranger [`0x7aD3…f991`](https://explorer-studio.genlayer.com/address/0x7aD34fEF06004a0272bB1C9c5e7B611a2Af6f991) | `settle` | FINALIZED · MAJORITY_AGREE | refused: referrals are open until 2026-11-08T21:23:58Z | [`0x68811148…52e5`](https://explorer-studio.genlayer.com/tx/0x688111482964247d215c94ab89d26271e14f546d3e126bbb4f3eee7e4d4352e5) |
| 8 | a late referral after the window closes | stranger [`0x7aD3…f991`](https://explorer-studio.genlayer.com/address/0x7aD34fEF06004a0272bB1C9c5e7B611a2Af6f991) | `refer` | FINALIZED · MAJORITY_AGREE | refused: referrals closed at 2026-11-08T21:23:58Z; a late referral is never judged | [`0xc7d25e90…f60f`](https://explorer-studio.genlayer.com/tx/0xc7d25e907e089e90c789ac286019999b3975eb48ab770f5100f60fd1148ef60f) |
| 9 | program 0 settled: the unused third slot returned | stranger [`0x7aD3…f991`](https://explorer-studio.genlayer.com/address/0x7aD34fEF06004a0272bB1C9c5e7B611a2Af6f991) | `settle` | FINALIZED · MAJORITY_AGREE | executed | [`0xedc3df7e…38f3`](https://explorer-studio.genlayer.com/tx/0xedc3df7e1379acda19fe8483b8c2e2e4735274b5960b80e677759f83c08038f3) |
