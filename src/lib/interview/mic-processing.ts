import { MIC_PROCESSING } from "@/lib/openai/realtime-config";

function rmsFromTimeDomain(buffer: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const v = (buffer[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buffer.length);
}

export function attachProcessedMic(audioCtx: AudioContext, sourceStream: MediaStream) {
  const source = audioCtx.createMediaStreamSource(sourceStream);
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = MIC_PROCESSING.highpassHz;
  highpass.Q.value = 0.7;

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.4;

  const gain = audioCtx.createGain();
  gain.gain.value = 0;

  const dest = audioCtx.createMediaStreamDestination();
  source.connect(highpass);
  highpass.connect(analyser);
  highpass.connect(gain);
  gain.connect(dest);

  const buffer = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>;
  let openUntil = 0;
  let raf = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(buffer);
    const rms = rmsFromTimeDomain(buffer);
    const now = performance.now();
    if (rms >= MIC_PROCESSING.gateOpenRms) {
      openUntil = now + MIC_PROCESSING.hangoverMs;
    } else if (rms >= MIC_PROCESSING.gateCloseRms && now < openUntil) {
      openUntil = now + MIC_PROCESSING.hangoverMs;
    }
    const open = now < openUntil;
    gain.gain.setTargetAtTime(open ? 1 : 0, audioCtx.currentTime, 0.02);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stream: dest.stream,
    analyser,
    stop() {
      cancelAnimationFrame(raf);
      try {
        source.disconnect();
        highpass.disconnect();
        analyser.disconnect();
        gain.disconnect();
      } catch {
        // already closed
      }
    },
  };
}
