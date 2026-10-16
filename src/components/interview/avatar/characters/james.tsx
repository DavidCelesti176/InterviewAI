import { Brows } from "@/components/interview/avatar/features/brows";
import { Eyes } from "@/components/interview/avatar/features/eyes";
import { Mouth } from "@/components/interview/avatar/features/mouth";
import type { CharacterLook } from "@/components/interview/avatar/types";

const face =
  "M200 118 C228 116 254 138 262 174 C270 212 266 250 258 278 C246 318 224 342 200 348 C176 342 154 318 142 278 C134 250 130 212 138 174 C146 138 172 116 200 118 Z";

export function JamesFigure({ id, look }: { id: string; look: CharacterLook }) {
  const skin = `url(#${id}-skin)`;
  const hair = `url(#${id}-hair)`;
  return (
    <>
      <g className="avatar-body">
        <path d="M40 480 V416 C80 356 128 334 172 356 C186 366 194 376 200 384 C206 376 214 366 228 356 C272 334 320 356 360 416 V480 Z" fill={`url(#${id}-blazer)`} />
        <path d="M40 480 V416 C80 356 128 334 172 356 C186 366 194 376 200 384 C206 376 214 366 228 356 C272 334 320 356 360 416 V480 Z" fill="none" stroke={look.lapel[0]} strokeWidth="1.4" opacity="0.35" />
        <path d="M172 358 C164 390 162 424 176 446 L198 412 L200 378 Z" fill={look.lapel[0]} />
        <path d="M228 358 C236 390 238 424 224 446 L202 412 L200 378 Z" fill={look.lapel[1]} />
        <path d="M190 372 L200 412 L210 372 L205 470 H195 Z" fill={look.shirt} />
      </g>
      <g className="avatar-head">
        <path d="M200 62 C248 68 290 124 284 176 C276 198 262 192 248 184 C228 172 172 172 152 184 C138 192 124 198 116 176 C110 124 152 68 200 62 Z" fill={hair} />
        <path d="M132 206 C118 216 116 238 126 252 C138 262 148 250 146 234 C144 220 140 210 132 206 Z" fill={look.skin[2]} />
        <path d="M130 218 C126 226 128 236 134 236 C140 234 140 224 136 218 Z" fill="#000" opacity="0.1" />
        <path d="M268 206 C282 216 284 238 274 252 C262 262 252 250 254 234 C256 220 260 210 268 206 Z" fill={look.skin[1]} />
        <path d="M270 218 C274 226 272 236 266 236 C260 234 260 224 264 218 Z" fill="#000" opacity="0.1" />
        <path d="M180 324 C176 358 184 384 200 394 C216 384 224 358 220 324 C212 334 188 334 180 324 Z" fill={skin} />
        <path d={face} fill={skin} />
        <path d={face} fill={`url(#${id}-light)`} />
        <path d="M154 262 C168 292 186 308 200 310 C184 300 168 280 154 262 Z" fill={look.skin[2]} opacity="0.18" />
        <ellipse cx="160" cy="258" rx="11" ry="5" fill="#d49284" opacity={look.blush} />
        <ellipse cx="242" cy="258" rx="11" ry="5" fill="#d49284" opacity={look.blush * 0.7} />
        <ellipse cx="200" cy="332" rx="22" ry="5" fill="#000" opacity="0.06" />
        <path d="M200 222 C196 240 195 254 200 264 C205 254 204 240 200 222" fill={look.skin[2]} opacity="0.3" />
        <ellipse cx="193" cy="264" rx="3.4" ry="2" fill={look.skin[2]} opacity="0.22" />
        <ellipse cx="207" cy="264" rx="3.4" ry="2" fill={look.skin[2]} opacity="0.22" />
        <Brows variant="direct" />
        <Eyes id={id} left={170} right={230} y={206} scale={look.eyeScale} lid={look.skin[1]} />
        <Mouth smile={look.smile} lip={`url(#${id}-lip)`} drop={14} />
      </g>
    </>
  );
}
