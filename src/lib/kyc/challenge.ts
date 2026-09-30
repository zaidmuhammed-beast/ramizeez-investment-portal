import "server-only";
import { randomInt } from "node:crypto";
import { indexOf } from "../keys";
import { safeEqual } from "../crypto";
import { LIVENESS_PROMPTS } from "./types";

export type LivenessChallenge = { prompts: string[]; issuedAt: number; token: string };

const sign = (userId: string, prompts: string[], issuedAt: number) =>
  indexOf(`liveness:${userId}:${issuedAt}:${prompts.join("|")}`);

/** Issues a random sequence of 3 prompts, signed so the client cannot pick or reorder them. */
export function issueLivenessChallenge(userId: string): LivenessChallenge {
  const pool = [...LIVENESS_PROMPTS];
  const prompts: string[] = [pool.splice(0, 1)[0]]; // always start facing the camera
  while (prompts.length < 3) prompts.push(pool.splice(randomInt(0, pool.length), 1)[0]);
  const issuedAt = Date.now();
  return { prompts, issuedAt, token: sign(userId, prompts, issuedAt) };
}

export function verifyLivenessChallenge(userId: string, prompts: string[], issuedAt: number, token: string): boolean {
  return safeEqual(sign(userId, prompts, issuedAt), token);
}
