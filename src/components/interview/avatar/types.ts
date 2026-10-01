export type AvatarState = "idle" | "connecting" | "listening" | "speaking" | "muted" | "ended" | "error";

export interface InterviewerProfile {
  id: string;
  name: string;
  presentation: "feminine" | "masculine" | "neutral";
  avatarAsset?: string;
  voice?: string;
}
