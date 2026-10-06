"use client";

import { AnimatedInterviewer } from "@/components/interview/avatar/animated-interviewer";
import { interviewerProfiles } from "@/components/interview/avatar/profile";

export function InterviewerPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="flex flex-col gap-1">
        <span className="text-xl font-semibold tracking-tight">Choose your interviewer</span>
        <span className="text-sm text-muted">Pick who you&apos;d like to practice with.</span>
      </legend>
      <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {interviewerProfiles.map((profile) => {
          const selected = profile.id === value;
          return (
            <label
              key={profile.id}
              className={`interviewer-card flex cursor-pointer flex-col gap-3 rounded-[20px] border p-3 text-left transition duration-200 ${
                selected ? "border-accent bg-accent/5 shadow-[0_10px_30px_rgba(47,107,255,0.12)]" : "border-line bg-card hover:border-accent/30"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name="interviewer"
                value={profile.id}
                checked={selected}
                onChange={() => onChange(profile.id)}
              />
              <span className="relative block overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_18%,#f7f4ef,#d5deea)]">
                <AnimatedInterviewer id={`card-${profile.id}`} look={profile.look} />
                {selected ? (
                  <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-accent text-sm text-white" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </span>
              <span className="flex flex-col gap-0.5 px-1 pb-1">
                <span className="text-base font-semibold">{profile.name}</span>
                <span className="text-xs font-medium tracking-wide text-accent uppercase">{profile.styleLabel}</span>
                <span className="text-sm leading-snug text-muted">{profile.shortDescription}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
