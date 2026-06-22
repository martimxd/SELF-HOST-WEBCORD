let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextClass = window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  audioContext = AudioContextClass ? new AudioContextClass() : null;
  return audioContext;
}

export async function enableNotificationSound() {
  const context = getAudioContext();
  if (context?.state === 'suspended') {
    await context.resume().catch(() => undefined);
  }
}

export async function playDirectMessageSound() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === 'suspended') {
    await context.resume().catch(() => undefined);
  }
  if (context.state !== 'running') return;

  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  gain.connect(context.destination);

  for (const [frequency, offset] of [[660, 0], [880, 0.11]] as const) {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now + offset);
    oscillator.connect(gain);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.2);
  }
}
