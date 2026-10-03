export type AvatarState = "idle" | "connecting" | "listening" | "speaking" | "muted" | "ended" | "error";

export type MouthState = "closed" | "small" | "medium" | "wide";

export type VisualPersonality = "warm" | "balanced" | "direct" | "executive";

export interface InterviewerAvatarAssets {
  base: string;
  eyesOpen?: string;
  eyesClosed?: string;
  mouthClosed?: string;
  mouthSmall?: string;
  mouthMedium?: string;
  mouthWide?: string;
}

export interface InterviewerProfile {
  id: string;
  name: string;
  title: string;
  styleLabel: string;
  shortDescription: string;
  visualPersonality: VisualPersonality;
  avatar: InterviewerAvatarAssets;
  voice?: string;
}
