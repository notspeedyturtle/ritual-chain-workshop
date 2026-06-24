"use client";

import { useState } from "react";
import {
  encodeAbiParameters,
  isHex,
  keccak256,
  parseAbiParameters,
  type Address,
} from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useNow } from "@/hooks/useNow";
import aiJudgeAbi from "@/abi/AIJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { canCommit, canReveal, type Bounty } from "@/lib/bounty";
import { useWriteTx } from "@/hooks/useWriteTx";
import {
  Card,
  CardHeader,
  CardBody,
  Field,
  Textarea,
  Button,
  TxStatus,
} from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;
const HASH_PARAMS = parseAbiParameters("string, bytes32, address, uint256");

function randomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function commitmentFor({
  bountyId,
  answer,
  salt,
  submitter,
}: {
  bountyId: bigint;
  answer: string;
  salt: `0x${string}`;
  submitter: Address;
}) {
  return keccak256(
    encodeAbiParameters(HASH_PARAMS, [answer, salt, submitter, bountyId]),
  );
}

function storageKey(bountyId: bigint, address?: Address) {
  return address
    ? `ai-judge-reveal:${bountyId.toString()}:${address.toLowerCase()}`
    : "";
}

export function SubmitAnswer({
  bountyId,
  bounty,
  onSubmitted,
}: {
  bountyId: bigint;
  bounty: Bounty;
  onSubmitted: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [answer, setAnswer] = useState("");
  const [salt, setSalt] = useState<`0x${string}`>(() => randomSalt());
  const [revealAnswer, setRevealAnswer] = useState("");
  const [revealSalt, setRevealSalt] = useState<`0x${string}`>("0x");
  const now = useNow();
  const tx = useWriteTx(() => onSubmitted());
  const revealTx = useWriteTx(() => {
    setRevealAnswer("");
    setRevealSalt("0x");
    onSubmitted();
  });

  const commitmentQuery = useReadContract({
    address: contractAddress,
    abi: aiJudgeAbi,
    functionName: "commitments",
    args:
      address && contractAddress
        ? [bountyId, address]
        : undefined,
    chainId: ritualChain.id,
    query: { enabled: !!address && !!contractAddress },
  });

  const userCommitment = commitmentQuery.data;
  const hasCommitted =
    !!userCommitment &&
    userCommitment !==
      "0x0000000000000000000000000000000000000000000000000000000000000000";

  const commitOpen = canCommit(bounty, now / 1000);
  const revealOpen = canReveal(bounty, now / 1000);

  if (!commitOpen && !revealOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !contractAddress || !address) return;
    const cleanAnswer = answer.trim();
    const commitment = commitmentFor({
      bountyId,
      answer: cleanAnswer,
      salt,
      submitter: address,
    });
    try {
      await tx.run({
        address: contractAddress,
        abi: aiJudgeAbi,
        functionName: "submitCommitment",
        args: [bountyId, commitment],
        chainId: ritualChain.id,
      });
      localStorage.setItem(
        storageKey(bountyId, address),
        JSON.stringify({ answer: cleanAnswer, salt, commitment }),
      );
      setAnswer("");
      setSalt(randomSalt());
      void commitmentQuery.refetch();
    } catch {
      /* surfaced via tx.state */
    }
  }

  function loadSavedReveal() {
    if (!address) return;
    const saved = localStorage.getItem(storageKey(bountyId, address));
    if (!saved) return;
    const parsed = JSON.parse(saved) as { answer?: string; salt?: `0x${string}` };
    setRevealAnswer(parsed.answer ?? "");
    setRevealSalt(parsed.salt ?? "0x");
  }

  async function handleReveal(e: React.FormEvent) {
    e.preventDefault();
    if (
      !revealAnswer.trim() ||
      !contractAddress ||
      !isHex(revealSalt) ||
      revealSalt.length !== 66
    ) {
      return;
    }
    try {
      await revealTx.run({
        address: contractAddress,
        abi: aiJudgeAbi,
        functionName: "revealAnswer",
        args: [bountyId, revealAnswer.trim(), revealSalt],
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  if (revealOpen) {
    return (
      <Card>
        <CardHeader
          title="Reveal your answer"
          subtitle="Reveal the answer and salt you used for your commitment."
        />
        <CardBody>
          <form onSubmit={handleReveal} className="space-y-3">
            <Field label="Answer">
              <Textarea
                value={revealAnswer}
                onChange={(e) => setRevealAnswer(e.target.value)}
                rows={5}
                placeholder="Paste the original answer…"
              />
            </Field>
            <Field label="Salt">
              <input
                value={revealSalt}
                onChange={(e) => setRevealSalt(e.target.value as `0x${string}`)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-indigo-400"
                placeholder="0x..."
              />
            </Field>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={loadSavedReveal}
                disabled={!isConnected}
                className="flex-1"
              >
                Load saved reveal
              </Button>
              <Button
                type="submit"
                disabled={
                  !isConnected ||
                  !hasCommitted ||
                  !revealAnswer.trim() ||
                  revealTx.isBusy
                }
                className="flex-1"
              >
                {revealTx.isBusy ? "Revealing…" : "Reveal answer"}
              </Button>
            </div>
            {!hasCommitted && isConnected && (
              <p className="text-xs text-zinc-500">
                This wallet has no commitment for this bounty.
              </p>
            )}
            <TxStatus
              state={revealTx.state}
              error={revealTx.error}
              hash={revealTx.hash}
              explorerBase={explorerBase}
            />
          </form>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Submit a commitment"
        subtitle="Your answer stays off-chain until the reveal phase."
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Your answer">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              placeholder="Write your private submission…"
            />
          </Field>
          <p className="text-xs text-zinc-500">
            A random salt is generated locally. Keep this browser data until
            you reveal, or copy your answer and salt somewhere private.
          </p>
          <Button
            type="submit"
            disabled={
              !isConnected || !answer.trim() || tx.isBusy || hasCommitted
            }
            className="w-full"
          >
            {tx.isBusy
              ? "Submitting…"
              : hasCommitted
                ? "Commitment submitted"
                : "Submit commitment"}
          </Button>
          {!isConnected && (
            <p className="text-xs text-zinc-500">
              Connect your wallet to submit.
            </p>
          )}
          <TxStatus
            state={tx.state}
            error={tx.error}
            hash={tx.hash}
            explorerBase={explorerBase}
          />
        </form>
      </CardBody>
    </Card>
  );
}
