import { AvatarEyes } from "@/components/interview/avatar/avatar-eyes";
import { AvatarMouth } from "@/components/interview/avatar/avatar-mouth";

export function AvatarFace() {
  return (
    <svg className="h-full w-full" viewBox="0 0 400 480" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="avatar-skin" x1="140" y1="80" x2="270" y2="340" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0c4a4" />
          <stop offset="0.5" stopColor="#d9a07c" />
          <stop offset="1" stopColor="#c08a66" />
        </linearGradient>
        <linearGradient id="avatar-hair" x1="80" y1="40" x2="300" y2="260" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4e433c" />
          <stop offset="0.4" stopColor="#2c241f" />
          <stop offset="1" stopColor="#161311" />
        </linearGradient>
        <linearGradient id="avatar-blazer" x1="20" y1="300" x2="220" y2="480" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#465b78" />
          <stop offset="1" stopColor="#1b2836" />
        </linearGradient>
        <radialGradient id="avatar-light" cx="36%" cy="28%" r="48%">
          <stop offset="0" stopColor="#fff6ee" stopOpacity="0.45" />
          <stop offset="0.7" stopColor="#fff6ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="avatar-body">
        <path d="M0 360 C80 300 130 286 176 304 L200 328 L224 304 C270 286 320 300 400 360 L400 480 L0 480 Z" fill="url(#avatar-blazer)" />
        <path d="M188 318 L160 392 L186 402 L200 346 Z" fill="#567196" />
        <path d="M212 318 L240 392 L214 402 L200 346 Z" fill="#31465f" />
        <path d="M190 312 H210 L206 366 H194 Z" fill="#f7f2ea" />
        <path d="M196 312 H204 L202 336 H198 Z" fill="#e6dcd0" />
        <path d="M178 248 C176 300 186 336 200 352 C214 336 224 300 222 248 C212 262 188 262 178 248 Z" fill="#d7a07e" />
      </g>

      <g className="avatar-head">
        <ellipse cx="108" cy="220" rx="13" ry="20" fill="#c48968" />
        <ellipse cx="292" cy="220" rx="13" ry="20" fill="#b57c59" />
        <path d="M108 214 Q100 224 108 232" fill="none" stroke="#a86d4e" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M292 214 Q300 224 292 232" fill="none" stroke="#8d5c42" strokeWidth="1.4" strokeLinecap="round" />
        <path
          d="M112 214 C104 132 148 62 204 58 C272 62 308 132 292 214 C278 176 244 148 204 150 C160 148 124 176 112 214 Z"
          fill="url(#avatar-hair)"
        />
        <path
          d="M200 108 C262 112 292 156 290 206 C288 262 260 308 200 318 C140 308 112 262 110 206 C108 156 138 112 200 108 Z"
          fill="url(#avatar-skin)"
        />
        <path
          d="M200 108 C262 112 292 156 290 206 C288 262 260 308 200 318 C140 308 112 262 110 206 C108 156 138 112 200 108 Z"
          fill="url(#avatar-light)"
        />
        <path d="M150 132 C176 118 214 118 248 136 C220 126 176 126 150 132 Z" fill="#241e1b" opacity="0.9" />
        <path d="M198 204 Q192 226 186 236" fill="none" stroke="#c08a66" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
        <path d="M186 236 Q200 242 214 236" fill="none" stroke="#b57d58" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <AvatarEyes />
        <AvatarMouth />
      </g>
    </svg>
  );
}
