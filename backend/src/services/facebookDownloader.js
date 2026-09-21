import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { ensureYtDlp, binaryPath } from "../../scripts/ensureYtDlp.js";

const MAX_BYTES = 150 * 1024 * 1024;
const YTDLP_PATH = binaryPath;

function runYtDlp(args, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_PATH, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stderr = "";
    child.stdout.on("data", () => {});
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Object.assign(new Error("yt-dlp timed out."), { code: "FACEBOOK_DOWNLOADER_TIMEOUT" }));
    }, timeoutMs);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(Object.assign(new Error(stderr.trim() || `yt-dlp exited with code ${code}`), {
        code: "FACEBOOK_DOWNLOADER_FAILED", exitCode: code
      }));
    });
  });
}

async function findDownloadedFile(prefix) {
  const entries = await fs.readdir(os.tmpdir());
  const matches = entries.filter(name => name.startsWith(prefix)).map(name => path.join(os.tmpdir(), name));
  if (!matches.length) return null;
  const stats = await Promise.all(matches.map(async filePath => ({ filePath, stat: await fs.stat(filePath) })));
  stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return stats[0].filePath;
}

export async function downloadFacebookVideoWithYtDlp(url) {
  const ready = await ensureYtDlp();
  if (!ready) {
    throw {
      code: "FACEBOOK_DOWNLOADER_UNAVAILABLE",
      message: "The server video downloader could not be installed automatically."
    };
  }

  const prefix = `aica-fb-${randomUUID()}`;
  const outputTemplate = path.join(os.tmpdir(), `${prefix}.%(ext)s`);
  const args = [
    "--no-playlist", "--no-warnings", "--no-progress", "--no-cache-dir",
    "--retries", "2", "--socket-timeout", "30", "--max-filesize", "150M",
    "-f", "best[height<=720][ext=mp4]/best[height<=720]/best",
    "-o", outputTemplate, url
  ];

  try {
    await runYtDlp(args);
    const filePath = await findDownloadedFile(prefix);
    if (!filePath) throw { code: "FACEBOOK_VIDEO_DOWNLOAD_FAILED", message: "The downloader completed without producing a video file." };

    const stat = await fs.stat(filePath);
    if (stat.size <= 0) {
      await fs.unlink(filePath).catch(() => {});
      throw { code: "FACEBOOK_VIDEO_DOWNLOAD_FAILED", message: "The downloader produced an empty video file." };
    }
    if (stat.size > MAX_BYTES) {
      await fs.unlink(filePath).catch(() => {});
      throw { code: "FACEBOOK_VIDEO_TOO_LARGE", message: "The Facebook video is larger than the free 150 MB limit." };
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === ".webm" ? "video/webm" : ext === ".mov" ? "video/quicktime" : ext === ".mkv" ? "video/x-matroska" : "video/mp4";
    return { filePath, mimeType, sourceUrl: url, downloader: "yt-dlp" };
  } catch (error) {
    throw {
      code: error?.code || "FACEBOOK_DOWNLOADER_FAILED",
      message: `Public Facebook video extraction failed: ${(error?.message || "unknown error").slice(0, 500)}`
    };
  }
}
