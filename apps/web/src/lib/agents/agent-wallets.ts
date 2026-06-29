import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";

export type AgentId = "momentum" | "contrarian";

const AGENT_FILES: Record<AgentId, string> = {
  momentum: "agent-momentum.json",
  contrarian: "agent-contrarian.json",
};

function platformDir(): string {
  const candidates = [
    join(process.cwd(), "platform"),
    join(process.cwd(), "..", "..", "platform"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  const created = join(process.cwd(), "platform");
  mkdirSync(created, { recursive: true });
  return created;
}

export function loadOrCreateAgentKeypair(agentId: AgentId): Keypair {
  const path = join(platformDir(), AGENT_FILES[agentId]);
  if (existsSync(path)) {
    const secret = JSON.parse(readFileSync(path, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  const kp = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

export function agentPublicKeys(): Record<AgentId, string> {
  return {
    momentum: loadOrCreateAgentKeypair("momentum").publicKey.toBase58(),
    contrarian: loadOrCreateAgentKeypair("contrarian").publicKey.toBase58(),
  };
}
