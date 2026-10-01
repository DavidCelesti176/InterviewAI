"use client";

import { memo, useRef, type RefObject } from "react";

import { AvatarFace } from "@/components/interview/avatar/avatar-face";
import { AvatarHalo } from "@/components/interview/avatar/avatar-halo";
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
      className="avatar-stage relative aspect-[5/6] h-full max-h-[440px] w-auto max-w-full"
      data-avatar-state={state}
      data-avatar-id={profile.id}
    >
      <AvatarHalo />
      <AvatarFace />
    </div>
  );
});
