const MUTE_KEY = "checkers-muted-v1";

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean): void {
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

interface Tone {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

function playTones(tones: Tone[]): void {
  if (isMuted()) return;
  const audio = getContext();
  if (!audio) return;

  const now = audio.currentTime;

  for (const tone of tones) {
    const osc = audio.createOscillator();
    const gainNode = audio.createGain();
    osc.type = tone.type ?? "sine";
    osc.frequency.value = tone.freq;

    const peak = tone.gain ?? 0.12;
    const t0 = now + tone.start;
    const t1 = t0 + tone.duration;

    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(peak, t0 + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(gainNode);
    gainNode.connect(audio.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

export function playMove(): void {
  playTones([{ freq: 320, start: 0, duration: 0.09, type: "triangle", gain: 0.09 }]);
}

export function playCapture(): void {
  playTones([
    { freq: 220, start: 0, duration: 0.08, type: "square", gain: 0.1 },
    { freq: 150, start: 0.06, duration: 0.12, type: "square", gain: 0.11 },
  ]);
}

export function playKing(): void {
  playTones([
    { freq: 440, start: 0, duration: 0.1, type: "triangle", gain: 0.1 },
    { freq: 587, start: 0.09, duration: 0.12, type: "triangle", gain: 0.1 },
    { freq: 740, start: 0.18, duration: 0.16, type: "triangle", gain: 0.11 },
  ]);
}

export function playInvalid(): void {
  playTones([{ freq: 110, start: 0, duration: 0.14, type: "sawtooth", gain: 0.07 }]);
}

export function playWin(): void {
  playTones([
    { freq: 523, start: 0, duration: 0.12, type: "triangle", gain: 0.1 },
    { freq: 659, start: 0.11, duration: 0.12, type: "triangle", gain: 0.1 },
    { freq: 784, start: 0.22, duration: 0.12, type: "triangle", gain: 0.1 },
    { freq: 1047, start: 0.33, duration: 0.28, type: "triangle", gain: 0.12 },
  ]);
}

export function vibrate(pattern: number | number[]): void {
  if (isMuted()) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
