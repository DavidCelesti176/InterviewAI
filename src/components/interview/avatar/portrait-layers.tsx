/* Layered portraits stay native images so eye and mouth overlays can be swapped without the image optimizer. */
/* eslint-disable @next/next/no-img-element */
import type { InterviewerProfile } from "@/components/interview/avatar/types";

/** Visual layers only. Audio stays on the GPT-Live element outside this tree. */
export function PortraitLayers({ profile }: { profile: InterviewerProfile }) {
  const { avatar, name } = profile;
  return (
    <div className="portrait-frame">
      <img className="portrait-base" src={avatar.base} alt="" />
      <img className="portrait-jaw" src={avatar.base} alt="" />
      {avatar.eyesOpen ? <img className="portrait-overlay portrait-eyes-open" src={avatar.eyesOpen} alt="" /> : null}
      {avatar.eyesClosed ? <img className="portrait-overlay portrait-eyes-closed" src={avatar.eyesClosed} alt="" /> : null}
      {avatar.mouthClosed ? <img className="portrait-overlay portrait-mouth-closed" src={avatar.mouthClosed} alt="" /> : null}
      {avatar.mouthSmall ? <img className="portrait-overlay portrait-mouth-small" src={avatar.mouthSmall} alt="" /> : null}
      {avatar.mouthMedium ? <img className="portrait-overlay portrait-mouth-medium" src={avatar.mouthMedium} alt="" /> : null}
      {avatar.mouthWide ? <img className="portrait-overlay portrait-mouth-wide" src={avatar.mouthWide} alt="" /> : null}
      <span className="portrait-blink" />
      <span className="portrait-light" />
      <span className="sr-only">{name}, AI interviewer</span>
    </div>
  );
}
