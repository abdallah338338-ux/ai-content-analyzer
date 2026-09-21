// Public Facebook URL resolver.
//
// This remains intentionally limited to PUBLIC content that Facebook exposes
// directly. We do not log in, use cookies, bypass privacy, defeat access
// controls, or use a private API token. If the public page does not expose a
// direct video file, the caller falls back to asking the user to upload it.

const MAX_BYTES = 150 * 1024 * 1024;
const VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/mpeg",
  "video/avi",
  "video/x-flv",
  "video/mpg",
  "video/x-matroska",
  "video/ogg",
]);

export function isFacebookUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch";
  } catch {
    return false;
  }
}

export function normalizeFacebookUrl(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  // Share links and reel links only need the path for public-page resolution.
  parsed.search = "";
  return parsed.toString();
}

export async function fetchFacebookOembed(url) {
  const endpoint =
    `https://graph.facebook.com/v26.0/oembed_video?url=${encodeURIComponent(url)}&omitscript=true`;

  let response;
  try {
    response = await fetch(endpoint, {
      headers: {
        "User-Agent": "AI-Content-Analyzer/1.0",
        "Accept": "application/json",
      },
    });
  } catch {
    throw {
      code: "FACEBOOK_OEMBED_UNREACHABLE",
      message: "Could not reach Facebook's public oEmbed service. Please try again.",
    };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const fbMessage = data?.error?.message;
    throw {
      code: "FACEBOOK_OEMBED_FAILED",
      message: fbMessage
        ? `Facebook rejected this link: ${fbMessage}`
        : "This Facebook link is not publicly accessible, or is not a supported video post.",
    };
  }

  return data;
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function unescapeJson(value) {
  return decodeHtml(value)
    .replace(/\\u0025/gi, "%")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\u00253A/gi, ":");
}

function cleanCandidate(value) {
  if (!value || typeof value !== "string") return null;
  let candidate = unescapeJson(value).trim();
  candidate = candidate.replace(/^["']|["']$/g, "");
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

function extractCandidates(html) {
  const candidates = [];
  const add = (value) => {
    const cleaned = cleanCandidate(value);
    if (cleaned && !candidates.includes(cleaned)) candidates.push(cleaned);
  };

  // Standard Open Graph video tags.
  for (const match of html.matchAll(/<meta[^>]+(?:property|name)=["']og:video(?::url|:secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi)) {
    add(match[1]);
  }
  // Content-before-property variant.
  for (const match of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:video(?::url|:secure_url)?["'][^>]*>/gi)) {
    add(match[1]);
  }

  // Public page JSON sometimes contains a direct playable_url.
  const patterns = [
    /["']playable_url(?:_quality_hd)?["']s*:s*["']([^"']+)["']/gi,
    /["']video_url["']s*:s*["']([^"']+)["']/gi,
    /["']browser_native_hd_url["']s*:s*["']([^"']+)["']/gi,
    /["']browser_native_sd_url["']s*:s*["']([^"']+)["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) add(match[1]);
  }

  return candidates;
}

function extensionForMime(mime) {
  if (mime === "video/webm") return ".webm";
  if (mime === "video/quicktime") return ".mov";
  if (mime === "video/mpeg" || mime === "video/mpg") return ".mpeg";
  if (mime === "video/ogg") return ".ogv";
  return ".mp4";
}

export async function fetchPublicFacebookVideo(url, writeStreamFactory) {
  const parsed = new URL(url);
  const normalizedUrl = normalizeFacebookUrl(url);

  // Facebook can serve different HTML depending on the host/device and can
  // reject one public URL variant while serving another. We only try public
  // page variants; no login, cookies, private APIs, or access-control bypass.
  const variants = [];
  const addVariant = (candidate) => {
    if (candidate && !variants.includes(candidate)) variants.push(candidate);
  };

  addVariant(url);
  addVariant(normalizedUrl);

  for (const host of ["www.facebook.com", "m.facebook.com", "web.facebook.com"]) {
    const variant = new URL(normalizedUrl);
    variant.hostname = host;
    addVariant(variant.toString());
  }

  // Keep the original query on the desktop URL as a last-resort variant,
  // because some Reel/share links use it during Facebook's public redirect.
  const originalDesktop = new URL(url);
  originalDesktop.hostname = "www.facebook.com";
  addVariant(originalDesktop.toString());

  let lastPageStatus = null;
  let lastPageError = null;

  for (const pageUrl of variants) {
    let response;
    try {
      response = await fetch(pageUrl, {
        redirect: "follow",
        headers: {
          "User-Agent":
            pageUrl.includes("m.facebook.com")
              ? "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/153 Mobile Safari/537.36"
              : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch (error) {
      lastPageError = error;
      continue;
    }

    lastPageStatus = response.status;

    if (!response.ok) continue;

    const html = await response.text();
    const candidates = extractCandidates(html);

    if (!candidates.length) continue;

    for (const candidate of candidates) {
      let mediaResponse;
      try {
        mediaResponse = await fetch(candidate, {
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
            "Accept": "video/*,*/*;q=0.8",
          },
        });
      } catch {
        continue;
      }

      if (!mediaResponse.ok || !mediaResponse.body) continue;

      const mimeType =
        (mediaResponse.headers.get("content-type") || "")
          .split(";")[0]
          .toLowerCase();

      if (!VIDEO_MIMES.has(mimeType)) continue;

      const lengthHeader = mediaResponse.headers.get("content-length");
      const declaredLength = Number(lengthHeader);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) continue;

      const filePath = await writeStreamFactory(mediaResponse.body, {
        mimeType,
        extension: extensionForMime(mimeType),
        maxBytes: MAX_BYTES,
      });

      return {
        filePath,
        mimeType,
        sourceUrl: candidate,
        normalizedUrl,
        pageUrl,
      };
    }
  }

  if (lastPageStatus) {
    throw {
      code: "FACEBOOK_PAGE_UNAVAILABLE",
      message: `Facebook returned HTTP ${lastPageStatus} for this public link from the analysis server.`,
    };
  }

  if (lastPageError) {
    throw {
      code: "FACEBOOK_PAGE_UNREACHABLE",
      message: "Facebook's public video page could not be reached from the analysis server.",
    };
  }

  throw {
    code: "FACEBOOK_DIRECT_VIDEO_UNAVAILABLE",
    message:
      "Facebook's public page was reachable, but it did not expose a directly processable video file. Upload the video file directly for full analysis.",
  };
}

export function buildFacebookAnalysis(oembed, url) {
  return {
    title: oembed.title || "Facebook Video",
    overview:
      "This public Facebook video could not expose a directly processable media file to the free analysis server. No claim of full audio/visual analysis is made.",
    key_points: [],
    timeline: [],
    speech_analysis: "",
    visual_analysis: "",
    structure: "",
    evidence_notes: [],
    entities: [],
    uncertainties: [
      "Full multimodal analysis requires a directly accessible public video file. Uploading the video file directly is the fallback when Facebook does not expose one.",
    ],
  };
}
