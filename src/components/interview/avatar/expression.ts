import type { AvatarState, VisualPersonality } from "@/components/interview/avatar/types";

export type Expression = "rest" | "warm" | "direct" | "thinking" | "speaking";

export function expressionFor(personality: VisualPersonality, state: AvatarState): Expression {
  if (state === "speaking") return "speaking";
  if (state === "thinking") return "thinking";
  if (personality === "warm") return "warm";
  if (personality === "direct" || personality === "executive") return "direct";
  return "rest";
}

export function characterKey(id: string): "claire" | "james" {
  return id.includes("james") ? "james" : "claire";
}
