export type AvatarState = "idle" | "connecting" | "listening" | "speaking" | "muted" | "ended" | "error";

export type MouthState = "closed" | "small" | "medium" | "wide";

export type VisualPersonality = "warm" | "balanced" | "direct" | "executive";

export type HairStyle = "medium" | "waves" | "crop" | "bob";

export type JawShape = "round" | "defined";

/** Illustrated look only. Swap a character by editing these colors and shapes. */
export interface CharacterLook {
  skin: [string, string, string];
  hair: [string, string];
  hairStyle: HairStyle;
  iris: string;
  lip: string;
  blazer: [string, string];
  lapel: [string, string];
  shirt: string;
  eyeScale: number;
  smile: number;
  jaw: JawShape;
  blush: number;
  beard?: boolean;
}

export interface InterviewerProfile {
  id: string;
  name: string;
  title: string;
  styleLabel: string;
  shortDescription: string;
  visualPersonality: VisualPersonality;
  look: CharacterLook;
  voice?: string;
}
