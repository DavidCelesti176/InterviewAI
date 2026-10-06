import { currentIdToken } from "@/lib/firebase/client";
import type { InterviewPauseEvent } from "@/lib/interview/help-types";
import { buildContinueInstruction } from "@/lib/interview/interview-phase";
import { openingInstruction } from "@/lib/interview/opening";
import { pauseInstruction, resumeInstruction, resumeRepeatInstruction } from "@/lib/interview/session-cues";
import type { InterviewTurn } from "@/lib/interview/types";

export type InterviewStatus =
  | "Ready"
  | "Connecting"
  | "Speaking"
  | "Listening"
  | "Thinking"
  | "Ended"
  | "Error";

export type DebugEntry = {
  id: number;
  at: string;
  label: string;
  detail: string;
};

export type InterviewSnapshot = {
  status: InterviewStatus;
  errorMessage: string | null;
  elapsedMs: number;
  muted: boolean;
  level: number;
  bars: number[];
  canStart: boolean;
  canMute: boolean;
  canEnd: boolean;
  autoplayBlocked: boolean;
  debug: DebugEntry[];
  inputTranscript: string;
  outputTranscript: string;
  turns: InterviewTurn[];
  paused: boolean;
  pausedMs: number;
  pauseEvents: InterviewPauseEvent[];
  voiceUsageWhilePausedSeconds: number;
  usageSeconds: number | null;
  contextUsageRatio: number | null;
  delegationFailures: number;
};

type LiveEvent = Record<string, unknown> & { type?: unknown };

const ICE_TIMEOUT_MS = 10_000;
const CLOSE_TIMEOUT_MS = 15_000;
const SPEAKING_THRESHOLD = 0.02;
const SPEAKING_HANGOVER_MS = 400;
const CONTINUE_AFTER_MS = 7_000;
const THINKING_AFTER_MS = 2_500;
const DEBUG_LIMIT = 300;
const BAR_COUNT = 8;

const emptyBars = () => Array.from({ length: BAR_COUNT }, () => 0);

export function createSnapshot(): InterviewSnapshot {
  return {
    status: "Ready",
    errorMessage: null,
    elapsedMs: 0,
    muted: false,
    level: 0,
    bars: emptyBars(),
    canStart: true,
    canMute: false,
    canEnd: false,
    autoplayBlocked: false,
    debug: [],
    inputTranscript: "",
    outputTranscript: "",
    turns: [],
    paused: false,
    pausedMs: 0,
    pauseEvents: [],
    voiceUsageWhilePausedSeconds: 0,
    usageSeconds: null,
    contextUsageRatio: null,
    delegationFailures: 0,
  };
}

function startErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "The browser blocked the microphone. Open this site in Safari or Chrome, allow microphone access for the site, and allow the browser under System Settings, Privacy & Security, Microphone. Then press Start Interview again.";
  }
  if (name === "NotFoundError") {
    return "No microphone was found. Connect a microphone and press Start Interview again.";
  }
  return error instanceof Error ? error.message : String(error);
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function eventType(event: LiveEvent): string {
  return typeof event.type === "string" ? event.type : "unknown";
}

function delegationId(event: LiveEvent): string | null {
  if (!isRecord(event.delegation)) return null;
  const id = event.delegation.id;
  return typeof id === "string" && id.trim() ? id : null;
}

function transcriptDelta(event: LiveEvent): string | null {
  return typeof event.delta === "string" ? event.delta : null;
}

function eventTimestamp(event: LiveEvent): number {
  return typeof event.start_ms === "number" ? event.start_ms : 0;
}

export type SessionCues = {
  opening: string;
  continuePrompt: string;
};

export class InterviewSession {
  private snapshot = createSnapshot();
  private listeners = new Set<(snapshot: InterviewSnapshot) => void>();
  private peer: RTCPeerConnection | null = null;
  private events: RTCDataChannel | null = null;
  private microphone: MediaStream | null = null;
  private audio = new Audio();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private visualFrame = 0;
  private startedAt: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private closeTimeout: ReturnType<typeof setTimeout> | null = null;
  private ready = false;
  private finalized = false;
  private closing = false;
  private cleaned = false;
  private greetingSent = false;
  private nextDebugId = 1;
  private nextCommandId = 1;
  private handledDelegations = new Set<string>();
  private speakingUntil = 0;
  private generation = 0;
  private turns: InterviewTurn[] = [];
  private turnCounter = 0;
  private openSpeaker: InterviewTurn["speaker"] | null = null;
  private openText = "";
  private openTimestamp = 0;
  private lastCandidateSpeechAt: number | null = null;
  private targetDurationMinutes = 30;
  private lastInterviewerSpeechAt: number | null = null;
  private continueTimer: ReturnType<typeof setTimeout> | null = null;
  private nudgedForTurn = false;
  private pausedAt: number | null = null;
  private pausedTotalMs = 0;
  private pauseEvents: InterviewPauseEvent[] = [];
  private mutedForPause = false;
  private resumeMuted = false;
  private pauseUsageBaseline: number | null = null;
  private pausedUsageAccumulated = 0;
  private timeDomain = new Uint8Array(0);
  private frequency = new Uint8Array(0);

  constructor(
    private audioSlot: HTMLElement | null,
    private cues: SessionCues | null = null,
  ) {
    this.audio.autoplay = true;
    this.audio.className = "w-full";
  }

  subscribe(listener: (snapshot: InterviewSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async start(
    interviewId: string,
    interviewerId?: string,
    targetDurationMinutes = 30,
    options?: { storyPractice?: boolean },
  ): Promise<void> {
    if (!this.snapshot.canStart) return;
    this.generation += 1;
    const generation = this.generation;
    this.resetForStart();
    this.targetDurationMinutes = Number.isFinite(targetDurationMinutes) && targetDurationMinutes > 0 ? targetDurationMinutes : 30;
    this.patch({ status: "Connecting", canStart: false, errorMessage: null, autoplayBlocked: false });

    try {
      const AudioContextCtor = window.AudioContext;
      this.audioContext = new AudioContextCtor();
      await this.audioContext.resume();

      const connection = new RTCPeerConnection();
      this.peer = connection;
      connection.addEventListener("track", (event) => {
        if (generation !== this.generation) return;
        this.attachRemoteAudio(event.track);
      });
      connection.addEventListener("connectionstatechange", () => {
        if (generation !== this.generation) return;
        if (connection.connectionState === "failed" && !this.finalized) {
          this.fail("WebRTC connection failed");
        }
      });

      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== this.generation) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      this.microphone = microphone;
      for (const track of microphone.getAudioTracks()) {
        connection.addTrack(track, microphone);
      }

      this.events = connection.createDataChannel("oai-events");
      this.events.addEventListener("message", (message) => {
        if (generation !== this.generation) return;
        this.onEventMessage(message.data);
      });
      this.events.addEventListener("close", () => {
        if (generation !== this.generation || this.finalized || this.cleaned) return;
        if (this.closing) {
          this.finalized = true;
          this.finish("Ended", null);
          return;
        }
        this.fail("Disconnected without final session usage.");
      });

      const offer = await connection.createOffer();
      if (generation !== this.generation) return;
      await connection.setLocalDescription(offer);
      if (generation !== this.generation) return;
      await this.waitForIce(connection);
      if (generation !== this.generation) return;

      const sdp = connection.localDescription?.sdp;
      if (!sdp) throw new Error("Missing local SDP offer");

      const token = await currentIdToken();
      if (!token) throw new Error("Sign in to continue.");
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-firebase-token": token },
        body: JSON.stringify({
          sdp,
          interviewId,
          interviewerId,
          ...(options?.storyPractice ? { storyPractice: true } : {}),
        }),
      });
      if (generation !== this.generation) return;
      if (!response.ok) {
        throw new Error(await this.readError(response));
      }

      const result: unknown = await response.json();
      if (generation !== this.generation) return;
      if (!isRecord(result) || !isRecord(result.transport) || typeof result.transport.sdp !== "string") {
        throw new Error("Session response did not include an SDP answer");
      }
      const sessionId = isRecord(result.session) && typeof result.session.id === "string" ? result.session.id : "";
      this.record("session.created", sessionId || "Live session created");

      await connection.setRemoteDescription({
        type: "answer",
        sdp: result.transport.sdp,
      });
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(startErrorMessage(error));
    }
  }

  mute(): void {
    if (!this.snapshot.canMute || this.snapshot.muted) return;
    this.send({
      type: "session.input_audio.mute",
      event_id: this.commandId("mute"),
    });
    this.setMicrophoneEnabled(false);
    this.patch({ muted: true });
  }

  unmute(): void {
    if (!this.snapshot.canMute || !this.snapshot.muted) return;
    this.send({
      type: "session.input_audio.unmute",
      event_id: this.commandId("unmute"),
    });
    this.setMicrophoneEnabled(true);
    this.patch({ muted: false });
  }

  pause(): void {
    if (!this.ready || this.closing || this.pausedAt !== null || !this.events || this.events.readyState !== "open") return;
    this.pausedAt = Date.now();
    this.resumeMuted = this.snapshot.muted;
    this.mutedForPause = !this.snapshot.muted;
    if (this.mutedForPause) {
      this.send({ type: "session.input_audio.mute", event_id: this.commandId("pause_mute") });
      this.setMicrophoneEnabled(false);
    }
    this.audio.pause();
    if (this.continueTimer) clearTimeout(this.continueTimer);
    this.continueTimer = null;
    this.pauseUsageBaseline = this.snapshot.usageSeconds ?? 0;
    this.send({
      type: "session.instructions.append",
      event_id: this.commandId("pause"),
      delegation_id: null,
      content: pauseInstruction,
    });
    this.patch({
      paused: true,
      muted: true,
      canMute: false,
      elapsedMs: this.activeElapsed(),
      voiceUsageWhilePausedSeconds: this.pausedUsageNow(),
    });
  }

  resume(repeatQuestion = false): void {
    if (this.pausedAt === null || this.closing) return;
    this.settlePause();
    if (this.mutedForPause) {
      this.send({ type: "session.input_audio.unmute", event_id: this.commandId("pause_unmute") });
      this.setMicrophoneEnabled(true);
    }
    const muted = this.resumeMuted;
    this.mutedForPause = false;
    this.resumePlayback();
    this.send({
      type: "session.instructions.append",
      event_id: this.commandId("resume"),
      delegation_id: null,
      content: repeatQuestion ? resumeRepeatInstruction : resumeInstruction,
    });
    this.patch({
      paused: false,
      muted,
      canMute: true,
      elapsedMs: this.activeElapsed(),
      pausedMs: this.pausedTotalMs,
      pauseEvents: this.pauseEvents,
      voiceUsageWhilePausedSeconds: this.pausedUsageAccumulated,
    });
  }

  end(): void {
    if (!this.snapshot.canEnd || !this.events || this.events.readyState !== "open") return;
    this.closing = true;
    this.patch({ canEnd: false, canMute: false });
    this.record("session.close", "Finishing the conversation");
    this.send({ type: "session.close", event_id: this.commandId("close") });
    this.closeTimeout = setTimeout(() => {
      if (this.cleaned || this.finalized) return;
      this.finalized = true;
      this.finish("Ended", null);
    }, CLOSE_TIMEOUT_MS);
  }

  dispose(): void {
    this.releaseMedia();
  }

  private resetForStart(): void {
    this.releaseMedia();
    this.ready = false;
    this.finalized = false;
    this.closing = false;
    this.cleaned = false;
    this.greetingSent = false;
    this.startedAt = null;
    this.handledDelegations.clear();
    this.speakingUntil = 0;
    this.turns = [];
    this.turnCounter = 0;
    this.openSpeaker = null;
    this.openText = "";
    this.openTimestamp = 0;
    this.lastCandidateSpeechAt = null;
    this.lastInterviewerSpeechAt = null;
    this.nudgedForTurn = false;
    this.pausedAt = null;
    this.pausedTotalMs = 0;
    this.pauseEvents = [];
    this.mutedForPause = false;
    this.resumeMuted = false;
    this.pauseUsageBaseline = null;
    this.pausedUsageAccumulated = 0;
    this.snapshot = {
      ...createSnapshot(),
      status: "Connecting",
      canStart: false,
    };
    this.emit();
  }

  private attachRemoteAudio(track: MediaStreamTrack): void {
    const stream = new MediaStream([track]);
    this.audio.srcObject = stream;
    this.audio.controls = false;
    if (this.audioSlot && !this.audioSlot.contains(this.audio)) {
      this.audioSlot.append(this.audio);
    }
    this.resumePlayback();
    track.addEventListener("unmute", this.resumePlayback);

    if (!this.audioContext) return;
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    this.analyser = analyser;
    this.timeDomain = new Uint8Array(analyser.fftSize);
    this.frequency = new Uint8Array(analyser.frequencyBinCount);
    this.visualFrame = window.requestAnimationFrame(this.paintAudio);
  }

  private paintAudio = (): void => {
    if (this.cleaned) return;
    this.visualFrame = window.requestAnimationFrame(this.paintAudio);
    if (this.pausedAt !== null) return;
    const analyser = this.analyser;
    if (!analyser) return;

    analyser.getByteTimeDomainData(this.timeDomain);
    let sum = 0;
    for (const value of this.timeDomain) {
      const centered = (value - 128) / 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / this.timeDomain.length);

    analyser.getByteFrequencyData(this.frequency);
    const bars = emptyBars();
    const span = Math.floor(this.frequency.length / BAR_COUNT);
    for (let index = 0; index < BAR_COUNT; index += 1) {
      let peak = 0;
      const start = index * span;
      for (let bin = start; bin < start + span; bin += 1) {
        peak = Math.max(peak, this.frequency[bin] ?? 0);
      }
      bars[index] = peak / 255;
    }

    const now = performance.now();
    if (rms > SPEAKING_THRESHOLD) this.speakingUntil = now + SPEAKING_HANGOVER_MS;
    const live =
      this.snapshot.status === "Speaking" || this.snapshot.status === "Listening" || this.snapshot.status === "Thinking";
    const speaking = now < this.speakingUntil;
    const waitingOnInterviewer =
      this.lastCandidateSpeechAt !== null &&
      (this.lastInterviewerSpeechAt === null || this.lastInterviewerSpeechAt < this.lastCandidateSpeechAt) &&
      Date.now() - this.lastCandidateSpeechAt >= THINKING_AFTER_MS;
    const status = !live ? this.snapshot.status : speaking ? "Speaking" : waitingOnInterviewer ? "Thinking" : "Listening";

    if (
      status !== this.snapshot.status ||
      Math.abs(rms - this.snapshot.level) > 0.03 ||
      bars.some((bar, index) => Math.abs(bar - (this.snapshot.bars[index] ?? 0)) > 0.08)
    ) {
      this.patch({ status, level: rms, bars });
    }
  };

  private onEventMessage(data: unknown): void {
    if (typeof data !== "string") return;
    let event: LiveEvent;
    try {
      const parsed: unknown = JSON.parse(data);
      if (!isRecord(parsed)) return;
      event = parsed;
    } catch {
      this.record("unparsed", data);
      return;
    }

    const type = eventType(event);
    this.record(type, JSON.stringify(event));

    if (type === "session.started") {
      this.onStarted();
      return;
    }
    if (type === "session.closed") {
      this.flushTurn();
      this.finalized = true;
      this.finish("Ended", null);
      return;
    }
    if (type === "session.usage.updated") {
      this.onUsage(event);
      return;
    }
    if (type === "session.delegation.created") {
      this.onUnexpectedDelegation(event);
      return;
    }
    if (type === "session.input_transcript.delta") {
      const delta = transcriptDelta(event);
      if (delta) {
        this.lastCandidateSpeechAt = Date.now();
        this.nudgedForTurn = false;
        if (this.pausedAt === null) this.scheduleContinue();
        this.appendSpeech("candidate", delta, eventTimestamp(event));
        this.patch({ inputTranscript: this.snapshot.inputTranscript + delta });
      }
      return;
    }
    if (type === "session.output_transcript.delta") {
      const delta = transcriptDelta(event);
      if (delta) {
        this.lastInterviewerSpeechAt = Date.now();
        this.nudgedForTurn = true;
        if (this.pausedAt === null) this.resumePlayback();
        this.appendSpeech("interviewer", delta, eventTimestamp(event));
        this.patch({ outputTranscript: this.snapshot.outputTranscript + delta });
      }
      return;
    }
    if (type === "session.input_audio.muted") {
      this.patch({ muted: true });
      return;
    }
    if (type === "session.input_audio.unmuted") {
      this.patch({ muted: false });
      return;
    }
    if (type === "error") {
      const details = isRecord(event.error) ? event.error : null;
      const message = details && typeof details.message === "string" ? details.message : "Live session error";
      const clientEventId = details && typeof details.client_event_id === "string" ? details.client_event_id : "";
      if (clientEventId.startsWith("unmute_")) {
        this.setMicrophoneEnabled(false);
        this.patch({ muted: true, errorMessage: message });
        return;
      }
      if (clientEventId.startsWith("mute_")) {
        this.setMicrophoneEnabled(true);
        this.patch({ muted: false, errorMessage: message });
        return;
      }
      this.patch({ errorMessage: message });
    }
  }

  private onStarted(): void {
    this.ready = true;
    this.startedAt = Date.now();
    this.timer = setInterval(() => {
      const elapsed = this.activeElapsed();
      if (elapsed !== this.snapshot.elapsedMs) this.patch({ elapsedMs: elapsed });
    }, 250);
    this.patch({
      status: "Listening",
      canMute: true,
      canEnd: true,
      elapsedMs: 0,
    });
    if (!this.greetingSent) {
      this.greetingSent = true;
      this.send({
        type: "session.instructions.append",
        event_id: this.commandId("greeting"),
        delegation_id: null,
        content: this.cues?.opening ?? openingInstruction,
      });
    }
  }

  private onUsage(event: LiveEvent): void {
    const usage = isRecord(event.usage) ? event.usage : null;
    const seconds = usage && typeof usage.seconds === "number" ? usage.seconds : null;
    if (this.pauseUsageBaseline !== null && seconds !== null) {
      this.patch({
        usageSeconds: seconds,
        contextUsageRatio: isRecord(event.context_window) && typeof event.context_window.usage_ratio === "number" ? event.context_window.usage_ratio : this.snapshot.contextUsageRatio,
        voiceUsageWhilePausedSeconds: this.pausedUsageAccumulated + Math.max(0, seconds - this.pauseUsageBaseline),
      });
      return;
    }
    const context = isRecord(event.context_window) ? event.context_window : null;
    const ratio = context && typeof context.usage_ratio === "number" ? context.usage_ratio : null;
    this.patch({
      usageSeconds: seconds ?? this.snapshot.usageSeconds,
      contextUsageRatio: ratio ?? this.snapshot.contextUsageRatio,
    });
  }

  private onUnexpectedDelegation(event: LiveEvent): void {
    const id = delegationId(event);
    const label = id ?? "missing-id";
    this.record("TEST FAILURE", `Unexpected session.delegation.created (${label})`);
    this.patch({ delegationFailures: this.snapshot.delegationFailures + 1 });
    if (this.pausedAt !== null) return;
    if (!id || this.handledDelegations.has(id)) return;
    this.handledDelegations.add(id);
    this.nudgedForTurn = true;
    this.send({
      type: "session.instructions.append",
      event_id: this.commandId("delegation"),
      delegation_id: id,
      content:
        "No backend tools exist. Do not wait. If the last answer was complete, move to the next topic. Ask a follow-up only when that answer was vague or incomplete. Do not delegate again.",
    });
  }

  private appendSpeech(speaker: InterviewTurn["speaker"], delta: string, timestampMs: number): void {
    if (this.openSpeaker && this.openSpeaker !== speaker) this.flushTurn();
    if (!this.openSpeaker) {
      this.openSpeaker = speaker;
      this.openTimestamp = timestampMs;
    }
    this.openText += delta;
  }

  private flushTurn(): void {
    const text = this.openText.trim();
    if (this.openSpeaker && text) {
      this.turnCounter += 1;
      this.turns = [
        ...this.turns,
        {
          id: `turn_${this.turnCounter}`,
          speaker: this.openSpeaker,
          text,
          timestampMs: this.openTimestamp,
        },
      ];
      this.patch({ turns: this.turns });
    }
    this.openSpeaker = null;
    this.openText = "";
    this.openTimestamp = 0;
  }

  private scheduleContinue(): void {
    if (this.continueTimer) clearTimeout(this.continueTimer);
    this.continueTimer = setTimeout(() => this.promptContinue(), CONTINUE_AFTER_MS);
  }

  private promptContinue(): void {
    this.continueTimer = null;
    if (this.cleaned || this.closing || !this.ready || this.pausedAt !== null || this.nudgedForTurn || this.snapshot.muted) return;
    const candidateSpokeAt = this.lastCandidateSpeechAt;
    if (candidateSpokeAt === null) return;
    if (this.lastInterviewerSpeechAt !== null && this.lastInterviewerSpeechAt > candidateSpokeAt) return;
    if (performance.now() < this.speakingUntil) {
      this.scheduleContinue();
      return;
    }
    this.nudgedForTurn = true;
    this.send({
      type: "session.instructions.append",
      event_id: this.commandId("continue"),
      delegation_id: null,
      content: this.cues?.continuePrompt ?? this.interviewContinueInstruction(),
    });
  }

  private interviewContinueInstruction(): string {
    const pending = this.openSpeaker === "candidate" ? this.openText : "";
    return buildContinueInstruction({
      elapsedMs: this.activeElapsed(),
      targetMinutes: this.targetDurationMinutes,
      turns: this.turns,
      pendingCandidateText: pending,
    });
  }

  private resumePlayback = (): void => {
    if (this.cleaned) return;
    void this.audioContext?.resume();
    void this.audio.play().catch(() => {
      this.audio.controls = true;
      this.patch({ autoplayBlocked: true });
    });
  };

  private send(event: Record<string, unknown>): void {
    if (!this.events || this.events.readyState !== "open") return;
    this.events.send(JSON.stringify(event));
    this.record(typeof event.type === "string" ? `send ${event.type}` : "send", JSON.stringify(event));
  }

  private commandId(name: string): string {
    this.nextCommandId += 1;
    return `${name}_${this.nextCommandId}`;
  }

  private async waitForIce(connection: RTCPeerConnection): Promise<void> {
    if (connection.iceGatheringState === "complete") return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.removeEventListener("icegatheringstatechange", onState);
        reject(new Error("Timed out while gathering ICE candidates"));
      }, ICE_TIMEOUT_MS);
      function onState() {
        if (connection.iceGatheringState !== "complete") return;
        clearTimeout(timeout);
        connection.removeEventListener("icegatheringstatechange", onState);
        resolve();
      }
      connection.addEventListener("icegatheringstatechange", onState);
      onState();
    });
  }

  private async readError(response: Response): Promise<string> {
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && typeof body.error === "string") return body.error;
    } catch {
      return response.statusText || "Live session creation failed";
    }
    return "Live session creation failed";
  }

  private setMicrophoneEnabled(enabled: boolean): void {
    for (const track of this.microphone?.getAudioTracks() ?? []) {
      track.enabled = enabled;
    }
  }

  private fail(message: string): void {
    this.finish("Error", message);
  }

  private activeElapsed(): number {
    if (this.startedAt === null) return 0;
    const openPause = this.pausedAt === null ? 0 : Date.now() - this.pausedAt;
    return Math.max(0, Date.now() - this.startedAt - this.pausedTotalMs - openPause);
  }

  private pausedUsageNow(): number {
    if (this.pauseUsageBaseline === null) return this.pausedUsageAccumulated;
    const current = this.snapshot.usageSeconds ?? this.pauseUsageBaseline;
    return this.pausedUsageAccumulated + Math.max(0, current - this.pauseUsageBaseline);
  }

  private settlePause(): void {
    if (this.pausedAt === null) return;
    const endedAt = Date.now();
    const durationMs = endedAt - this.pausedAt;
    this.pausedTotalMs += durationMs;
    this.pauseEvents = [...this.pauseEvents, { startedAt: this.pausedAt, endedAt, durationMs }];
    this.pausedUsageAccumulated = this.pausedUsageNow();
    this.pauseUsageBaseline = null;
    this.pausedAt = null;
  }

  private finish(status: "Ended" | "Error", message: string | null): void {
    if (this.cleaned) return;
    this.settlePause();
    this.flushTurn();
    this.cleaned = true;
    this.ready = false;
    if (this.closeTimeout) clearTimeout(this.closeTimeout);
    this.closeTimeout = null;
    if (this.continueTimer) clearTimeout(this.continueTimer);
    this.continueTimer = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.releaseMedia();
    this.patch({
      status,
      errorMessage: message,
      canStart: true,
      canMute: false,
      canEnd: false,
      paused: false,
      elapsedMs: this.startedAt === null ? this.snapshot.elapsedMs : this.activeElapsed(),
      pausedMs: this.pausedTotalMs,
      pauseEvents: this.pauseEvents,
      voiceUsageWhilePausedSeconds: this.pausedUsageAccumulated,
      level: 0,
      bars: emptyBars(),
    });
  }

  private releaseMedia(): void {
    if (this.visualFrame) cancelAnimationFrame(this.visualFrame);
    this.visualFrame = 0;
    this.microphone?.getTracks().forEach((track) => track.stop());
    this.microphone = null;
    this.events?.close();
    this.events = null;
    this.peer?.close();
    this.peer = null;
    this.audio.srcObject = null;
    this.audio.remove();
    void this.audioContext?.close();
    this.audioContext = null;
    this.analyser = null;
  }

  private record(label: string, detail: string): void {
    const entry: DebugEntry = {
      id: this.nextDebugId,
      at: timestamp(),
      label,
      detail,
    };
    this.nextDebugId += 1;
    const debug = [...this.snapshot.debug, entry].slice(-DEBUG_LIMIT);
    this.patch({ debug });
  }

  private patch(partial: Partial<InterviewSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.snapshot);
  }
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
