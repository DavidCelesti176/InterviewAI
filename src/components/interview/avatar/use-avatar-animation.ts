import { useEffect, useRef, type RefObject } from "react";

import { mouthState, mouthWeights, normalizeSpeechLevel } from "@/components/interview/avatar/avatar-motion";
import type { AvatarState } from "@/components/interview/avatar/types";

export function useAvatarAnimation(
  nodeRef: RefObject<HTMLElement | null>,
  levelRef: RefObject<number>,
  state: AvatarState,
) {
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = media.matches;
    let display = 0;
    let frame = 0;
    let nextBlink = performance.now() + 3200;
    let blinkUntil = 0;
    let secondBlinkAt = 0;
    let shownMouth = "";
    let lastLevelWrite = 0;

    const onMotion = () => {
      reduced = media.matches;
    };
    media.addEventListener("change", onMotion);

    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      const now = performance.now();
      const speaking = stateRef.current === "speaking";
      const target = speaking ? normalizeSpeechLevel(levelRef.current) : 0;
      display = reduced ? target : display * 0.72 + target * 0.28;
      if (display < 0.008) display = 0;
      const mouth = mouthWeights(display);
      const shape = mouthState(display);
      node.style.setProperty("--mouth", display.toFixed(3));
      node.style.setProperty("--mouth-closed", mouth.closed.toFixed(3));
      node.style.setProperty("--mouth-slight", mouth.slight.toFixed(3));
      node.style.setProperty("--mouth-medium", mouth.medium.toFixed(3));
      node.style.setProperty("--mouth-wide", mouth.wide.toFixed(3));
      if (shape !== shownMouth) {
        shownMouth = shape;
        node.dataset.mouth = shape;
        const debug = document.querySelector("[data-avatar-debug-mouth]");
        if (debug) debug.textContent = shape;
      }
      const canBlink = !reduced && stateRef.current !== "ended" && stateRef.current !== "error";
      if (canBlink && blinkUntil === 0 && now >= nextBlink) {
        blinkUntil = now + 120;
        if (Math.random() < 0.3) secondBlinkAt = blinkUntil + 220;
        nextBlink = now + 3000 + Math.random() * 5000;
      }
      if (secondBlinkAt && now >= secondBlinkAt && now >= blinkUntil) {
        blinkUntil = now + 90;
        secondBlinkAt = 0;
      }
      if (blinkUntil && now >= blinkUntil) blinkUntil = 0;
      node.style.setProperty("--blink", blinkUntil ? "1" : "0");
      if (now - lastLevelWrite > 200) {
        lastLevelWrite = now;
        const level = document.querySelector("[data-avatar-debug-level]");
        if (level) level.textContent = display.toFixed(2);
      }
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
