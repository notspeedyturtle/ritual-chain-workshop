# Test Plan

## Commit Phase

- Creating a bounty with zero reward should revert.
- Creating a bounty with a past deadline should revert.
- A participant can submit one non-zero commitment before the deadline.
- A participant cannot submit an empty commitment.
- A participant cannot submit a second commitment for the same bounty.
- The contract should stop accepting commitments after `MAX_SUBMISSIONS`.
- A participant cannot commit after the bounty deadline.

## Reveal Phase

- A participant cannot reveal before the bounty deadline.
- A participant cannot reveal without a prior commitment.
- A participant cannot reveal with the wrong answer.
- A participant cannot reveal with the wrong salt.
- A participant cannot reveal from a different wallet than the one that committed.
- A participant cannot reveal a commitment made for a different bounty.
- A participant cannot reveal twice.
- A valid reveal should append one eligible submission with the correct submitter
  and answer.
- Over-length answers should revert.

## Judging

- The owner cannot call `judgeAll` before the deadline.
- Non-owners cannot call `judgeAll`.
- `judgeAll` should revert if there are commitments but no valid revealed
  submissions.
- `judgeAll` should batch all revealed submissions in one LLM request.
- Once judged, no more reveals should be accepted.

## Finalization

- Non-owners cannot finalize the winner.
- The owner cannot finalize before judging.
- An invalid `winnerIndex` should revert.
- A valid finalization should mark the bounty finalized, store the winner index,
  zero the reward, and transfer the reward to the selected revealed submitter.
- A bounty cannot be finalized twice.
