"use client";

import { memo, useRef, type RefObject } from "react";

import { AvatarHalo } from "@/components/interview/avatar/avatar-halo";
import { PortraitLayers } from "@/components/interview/avatar/portrait-layers";
import type { AvatarState, InterviewerProfile } from "@/components/interview/avatar/types";
import { useAvatarAnimation } from "@/components/interview/avatar/use-avatar-animation";

export const InterviewerAvatar = memo(function InterviewerAvatar({
  state,
  levelRef,
  profile,
}: {
  state: AvatarState;
  levelRef: RefObject<number>;
  profile: InterviewerProfile;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  useAvatarAnimation(nodeRef, levelRef, state);

  return (
    <div
      ref={nodeRef}
      className="avatar-stage relative aspect-[3/4] h-full max-h-[min(62dvh,560px)] w-auto max-w-full"
      data-avatar-state={state}
      data-avatar-id={profile.id}
      data-mouth="closed"
    >
      <AvatarHalo />
      <div key={profile.id} className="avatar-portrait">
        <PortraitLayers profile={profile} />
      </div>
    </div>
  );
});
