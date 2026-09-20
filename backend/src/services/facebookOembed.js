// Metadata-only Facebook support.
//
// Gemini has no native "give me a Facebook URL" understanding the way it
// does for YouTube, and we do not scrape or bypass privacy to get the raw
// video file (see AI-Content-Analyzer-Master-Roadmap.md, "أشياء تم رفضها").
// So for Facebook links we only fetch official public oEmbed metadata
// (title + an embeddable HTML snippet). Full content analysis (overview,
// timeline, speech/visual analysis) requires the user to download and
// upload the video file directly, going through the image/video upload
// pipeline instead of a URL.
//
// As of June 15, 2026, Meta lifted the access-token requirement for its
// oEmbed APIs (tokenless access, up to 1,000 requests/hour per endpoint),
// so no Meta Developer App or token is required for this.

export function isFacebookUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("facebook.com") || host.includes("fb.watch");
  } catch {
    return false;
  }
}

export async function fetchFacebookOembed(url) {
  const endpoint = `https://graph.facebook.com/v26.0/oembed_video?url=${encodeURIComponent(url)}&omitscript=true`;

  let response;
  try {
    response = await fetch(endpoint);
  } catch (networkErr) {
    throw { code: "FACEBOOK_OEMBED_UNREACHABLE", message: "Could not reach Facebook's oEmbed API. Please try again." };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const fbMessage = data?.error?.message;
    throw {
      code: "FACEBOOK_OEMBED_FAILED",
      message: fbMessage
        ? `Facebook rejected this link: ${fbMessage}`
        : "This Facebook link isn't publicly accessible, or isn't a supported video post.",
    };
  }

  return data; // { html, type, version, provider_name, provider_url, width, height, title? }
}

export function buildFacebookAnalysis(oembed, url) {
  return {
    title: oembed.title || "Facebook Video",
    overview:
      "This is a public Facebook video. Full audio/visual analysis isn't available for Facebook links yet — " +
      "only public metadata could be retrieved via Facebook's official oEmbed API. For a full analysis " +
      "(overview, key points, timeline, speech & visual analysis), download this video yourself and upload " +
      "the file directly using the upload option instead of the link.",
    key_points: [],
    timeline: [],
    speech_analysis: "",
    visual_analysis: "",
    structure: "",
    evidence_notes: [],
    entities: [],
    uncertainties: [
      "Full content analysis is not available for Facebook links in this version — only metadata (title, provider) was retrieved.",
    ],
  };
}
