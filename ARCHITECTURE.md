# Architecture Note

## Required Track: Commit-Reveal

The implemented solution is chain-agnostic and works on any EVM chain. During
the commit phase, the only on-chain participant data is a `bytes32` commitment.
The plaintext answer and salt stay off-chain with the participant. After the
deadline, the participant reveals both values, and the contract verifies:

```solidity
keccak256(abi.encode(answer, salt, submitter, bountyId))
```

Only verified reveals are added to the `submissions` array. `judgeAll` therefore
loads only eligible revealed answers and sends them to the Ritual LLM precompile
as one batch. AI output is stored as advisory review, and the owner still makes
the final payout decision with `finalizeWinner`.

## Advanced Track: Ritual-Native Hidden Submissions

A Ritual-native hidden submission design would keep plaintext answers encrypted
until the judging step. On-chain storage would contain only metadata,
commitments, encrypted payload references, and proof that a submission was made
before the deadline. The encrypted answer bodies could live off-chain in IPFS,
S3, or another content-addressed store, while the chain stores the ciphertext
hash and owner/submitter metadata.

Plaintext should exist only inside the participant's client before encryption
and inside Ritual's TEE-backed executor during batch judging. The contract would
pass a batch of ciphertext references or private-input handles to the Ritual
executor. The executor would decrypt inside the TEE, build one judging prompt
with all submissions, call the LLM once, and return a signed or replayable
result to the contract. This preserves the key workshop idea: one batch judging
operation, not one LLM call per answer, while reducing public answer leakage
before the AI review is complete.
