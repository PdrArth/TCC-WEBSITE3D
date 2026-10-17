import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Own procedural synthesis. No recording, external sample or FFmpeg is used. */
export function createThunderWav() {
  const sourceRate = 48000, rate = 24000, seconds = 6.2;
  const raw = new Float64Array(sourceRate * seconds);
  let seed = 0x51a7c0de, low = 0, middle = 0;
  for (let index = 0; index < raw.length; index++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const white = (seed >>> 0) / 4294967296 * 2 - 1;
    const time = index / sourceRate;
    low = low * .995 + white * .045;
    middle = middle * .94 + white * .12;
    const crack = Math.exp(-time / .055);
    const body = (1 - Math.exp(-time / .035)) * Math.exp(-time / 1.65);
    const rolls = 1 + .65 * Math.exp(-(((time - .65) / .18) ** 2)) + .5 * Math.exp(-(((time - 1.8) / .32) ** 2)) + .4 * Math.exp(-(((time - 3.1) / .5) ** 2));
    raw[index] = (white * crack * .24 + (low * 2.7 + middle * .3) * body * rolls) * Math.min(1, time / .004, (seconds - time) / .12);
  }
  // Windowed-sinc antialias filter before decimation; keep the original 48kHz timbre.
  const taps = 63, radius = (taps - 1) / 2, cutoff = 10000 / sourceRate;
  const kernel = Array.from({ length: taps }, (_, i) => {
    const x = i - radius;
    return (x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x)) * (.5 - .5 * Math.cos(2 * Math.PI * i / (taps - 1)));
  });
  const sum = kernel.reduce((total, x) => total + x, 0);
  const pcm = new Float64Array(rate * seconds);
  let squares = 0;
  for (let i = 0; i < pcm.length; i++) {
    for (let tap = 0; tap < taps; tap++) pcm[i] += (raw[i * 2 + tap - radius] ?? 0) * kernel[tap] / sum;
    pcm[i] *= Math.min(1, i / (rate * .004), (pcm.length - 1 - i) / (rate * .012));
    squares += pcm[i] ** 2;
  }
  const scale = .2 / Math.sqrt(squares / pcm.length);
  const wav = Buffer.alloc(44 + pcm.length * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) wav.writeInt16LE(Math.round(Math.max(-.95, Math.min(.95, pcm[i] * scale)) * 32767), 44 + i * 2);
  return wav;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = fileURLToPath(new URL("../../public/experience/audio/thunder-v15.wav", import.meta.url));
  const wav = createThunderWav();
  if (process.argv.includes("--check")) {
    if (!wav.equals(await readFile(target))) throw new Error("The shipped thunder differs from its deterministic generator");
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, wav);
  }
  console.log(JSON.stringify({ file: target, bytes: wav.length, sha256: createHash("sha256").update(wav).digest("hex") }));
}
