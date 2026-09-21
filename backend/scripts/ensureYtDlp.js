import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binDir = path.resolve(__dirname, "../bin");
const binaryPath = path.join(binDir, "yt-dlp");

const urls = [
  "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp_linux",
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux",
];

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function download(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed with HTTP ${response.status}`);
  }

  const tmp = `${binaryPath}.tmp`;
  await fs.mkdir(binDir, { recursive: true });
  const file = await fs.open(tmp, "w");

  try {
    for await (const chunk of response.body) {
      await file.write(chunk);
    }
  } finally {
    await file.close();
  }

  await fs.chmod(tmp, 0o755);
  await fs.rename(tmp, binaryPath);
}

export async function ensureYtDlp() {
  if (await exists(binaryPath)) return true;

  let lastError = null;

  for (const url of urls) {
    try {
      console.log("[yt-dlp] downloading official Linux binary...");
      await download(url);
      console.log("[yt-dlp] ready");
      return true;
    } catch (error) {
      lastError = error;
      await fs.unlink(`${binaryPath}.tmp`).catch(() => {});
    }
  }

  console.warn(
    "[yt-dlp] runtime download failed:",
    lastError?.message || lastError || "unknown error"
  );
  return false;
}

export { binaryPath };
