import { InterviewerScene } from "@/components/interview/avatar/characters/scene";
import type { CharacterLook } from "@/components/interview/avatar/types";

export function AnimatedInterviewer({
  id,
  look,
  label,
}: {
  id: string;
  look: CharacterLook;
  label?: string;
}) {
  return <InterviewerScene id={id} look={look} label={label} />;
}
