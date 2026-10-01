import { useEffect, useRef, type RefObject } from "react";

import { mouthWeights, normalizeSpeechLevel } from "@/components/interview/avatar/avatar-motion";
import type { AvatarState } from "@/components/interview/avatar/types";

export function useAvatarAnimation(
  nodeRef: RefObject<HTMLElement | null>,
  levelRef: RefObject<number>,
  state: AvatarState,
) {
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = media.matches;
    let display = 0;
    let frame = 0;

    const onMotion = () => {
      reduced = media.matches;
    };
    media.addEventListener("change", onMotion);

    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      const speaking = stateRef.current === "speaking";
      const target = speaking ? normalizeSpeechLevel(levelRef.current) : 0;
      const follow = reduced ? 1 : speaking ? 0.3 : 0.5;
      display = display * (1 - follow) + target * follow;
      if (display < 0.008) display = 0;
      const mouth = mouthWeights(display);
      node.style.setProperty("--mouth-closed", mouth.closed.toFixed(3));
      node.style.setProperty("--mouth-slight", mouth.slight.toFixed(3));
      node.style.setProperty("--mouth-medium", mouth.medium.toFixed(3));
      node.style.setProperty("--mouth-wide", mouth.wide.toFixed(3));
      const base =
        stateRef.current === "speaking" ? 0.62 : stateRef.current === "listening" ? 0.4 : stateRef.current === "muted" ? 0.22 : 0.3;
      node.style.setProperty("--halo", (base + display * 0.38).toFixed(3));
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener("change", onMotion);
    };
  }, [levelRef, nodeRef]);
}
