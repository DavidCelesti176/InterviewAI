import { ClaireFigure } from "@/components/interview/avatar/characters/claire";
import { JamesFigure } from "@/components/interview/avatar/characters/james";
import { characterKey } from "@/components/interview/avatar/expression";
import type { CharacterLook } from "@/components/interview/avatar/types";

const figures = {
  claire: ClaireFigure,
  james: JamesFigure,
};

export function InterviewerScene({
  id,
  look,
  label,
}: {
  id: string;
  look: CharacterLook;
  label?: string;
}) {
  const Figure = figures[characterKey(id)];
  return (
    <svg
      className="h-full w-full"
      viewBox="48 48 304 400"
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ ["--brow" as string]: look.hair[1] }}
    >
      <defs>
        <linearGradient id={`${id}-skin`} x1="150" y1="90" x2="250" y2="340" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={look.skin[0]} />
          <stop offset="0.55" stopColor={look.skin[1]} />
          <stop offset="1" stopColor={look.skin[2]} />
        </linearGradient>
        <linearGradient id={`${id}-hair`} x1="120" y1="40" x2="280" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={look.hair[0]} />
          <stop offset="1" stopColor={look.hair[1]} />
        </linearGradient>
        <linearGradient id={`${id}-blazer`} x1="40" y1="300" x2="280" y2="480" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={look.blazer[0]} />
          <stop offset="1" stopColor={look.blazer[1]} />
        </linearGradient>
        <radialGradient id={`${id}-light`} cx="34%" cy="28%" r="52%">
          <stop offset="0" stopColor="#fff8f3" stopOpacity="0.55" />
          <stop offset="0.62" stopColor="#fff8f3" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-iris`} cx="38%" cy="32%" r="68%">
          <stop offset="0" stopColor="#efe2cc" />
          <stop offset="0.42" stopColor={look.iris} />
          <stop offset="1" stopColor="#1b140f" />
        </radialGradient>
        <linearGradient id={`${id}-lip`} x1="170" y1="250" x2="230" y2="290" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={look.lip} />
          <stop offset="1" stopColor={look.skin[2]} />
        </linearGradient>
      </defs>
      <Figure id={id} look={look} />
    </svg>
  );
}
