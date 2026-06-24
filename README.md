# Privacy-Preserving AI Bounty Judge

This submission upgrades the Ritual Academy AI Bounty Judge with a commit-reveal
submission flow. The goal is to keep participant answers hidden during the
submission phase so other participants cannot copy or improve visible answers
before the deadline.

## Lifecycle

1. The bounty owner creates a bounty with a title, rubric, reward, and deadline.
2. During the commit phase, participants do not publish their answers. Instead,
   they submit a commitment with:

   ```solidity
   submitCommitment(uint256 bountyId, bytes32 commitment)
   ```

3. The commitment is computed as:

   ```solidity
   keccak256(abi.encode(answer, salt, submitter, bountyId))
   ```

   Including `submitter` and `bountyId` prevents another wallet or another
   bounty from reusing the same reveal.

4. After the deadline, participants reveal their answer and salt:

   ```solidity
   revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt)
   ```

5. The contract recomputes the commitment. Only valid reveals are added to the
   revealed submissions list.
6. The bounty owner calls `judgeAll`, which sends all valid revealed answers in
   one batch to the Ritual LLM precompile.
7. The AI review is stored on-chain as advisory output.
8. The bounty owner calls `finalizeWinner` to choose the final winner and release
   the reward.

## Contract Changes

The updated contract is in `hardhat/contracts/AIJudge.sol`.

Required functions:

- `submitCommitment(uint256 bountyId, bytes32 commitment)`
- `revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt)`
- `judgeAll(uint256 bountyId, bytes calldata llmInput)`
- `finalizeWinner(uint256 bountyId, uint256 winnerIndex)`

Additional helper:

- `hashAnswer(uint256 bountyId, string calldata answer, bytes32 salt, address submitter)`

The frontend now commits a hash before the deadline and reveals the original
answer after the deadline. For demo usability, the browser stores the answer and
salt locally so the participant can reveal later.

## Running

```bash
cd hardhat
pnpm install
pnpm hardhat compile
```

The frontend lives in `web/`. Set `NEXT_PUBLIC_CONTRACT_ADDRESS` to the deployed
contract address before using the UI.

## Reflection

In a bounty system, the bounty title, rubric, reward, deadline, and final winner
should be public because participants need shared rules and the payout should be
auditable. Participant answers should stay hidden during the submission phase so
people cannot copy or slightly improve someone else's idea before the deadline.
Commitments can be public because they prove that an answer existed earlier
without revealing the answer itself. After the deadline, revealed answers can
become public so everyone can verify which submissions were eligible for judging.
AI should help rank or summarize submissions against the rubric, but it should
not have the final authority to release funds. A human bounty owner should make
the final decision because AI can hallucinate, misunderstand context, or be
influenced by malicious submission text. The best design is transparent where it
needs accountability and private where early disclosure would make the contest
unfair.
