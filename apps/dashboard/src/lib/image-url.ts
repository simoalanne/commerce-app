function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAcceptedImageUrl(value: string): boolean {
  if (!isValidHttpUrl(value)) {
    return false;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const canLoadImage = (url: string, timeoutMs = 8000) =>
  new Promise<boolean>((resolve) => {
    const image = new Image();
    let isDone = false;

    const cleanup = () => {
      if (isDone) {
        return;
      }
      isDone = true;
      image.onload = null;
      image.onerror = null;
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    image.onload = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(true);
    };

    image.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(false);
    };

    image.src = url;
  });

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function unwrapImageParam(value: string): string | null {
  if (!isValidHttpUrl(value)) {
    return null;
  }

  try {
    const parsed = new URL(value);
    const nestedParamKeys = ["imgurl", "mediaurl", "image_url", "image", "url", "u", "src"];

    for (const key of nestedParamKeys) {
      const nested = parsed.searchParams.get(key);
      if (!nested) {
        continue;
      }

      const decoded = safeDecode(nested.trim());
      if (isValidHttpUrl(decoded)) {
        return decoded;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeCandidateUrl(value: string): string {
  let current = safeDecode(value.trim());

  for (let index = 0; index < 3; index += 1) {
    const unwrapped = unwrapImageParam(current);
    if (!unwrapped || unwrapped === current) {
      break;
    }
    current = safeDecode(unwrapped);
  }

  return current;
}

function extractUrlsFromText(value: string): string[] {
  const matches = value.match(/https?:\/\/[^\s<>")\]]+/gi);
  if (!matches) {
    return [];
  }

  return matches.map((match) => match.replace(/[.,;:!?]+$/g, ""));
}

function extractMarkdownImageUrl(value: string): string | null {
  const markdownMatch = value.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
  return markdownMatch?.[1] ?? null;
}

function extractImageSrcFromHtml(value: string): string | null {
  const srcMatch = value.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!srcMatch) {
    return null;
  }

  const candidate = srcMatch[1]?.trim();
  return candidate && isValidHttpUrl(candidate) ? candidate : null;
}

function pickBestCandidate(candidates: string[]): string {
  const normalized = Array.from(
    new Set(
      candidates
        .map((candidate) => normalizeCandidateUrl(candidate))
        .filter((candidate) => candidate.length > 0),
    ),
  );

  if (normalized.length === 0) {
    return "";
  }

  const direct = normalized.find((candidate) => isValidHttpUrl(candidate));
  if (direct) {
    return direct;
  }

  return "";
}

export function extractDroppedImageUrl(dataTransfer: DataTransfer): string {
  const candidates: string[] = [];

  const html = dataTransfer.getData("text/html");
  if (html) {
    const fromImgTag = extractImageSrcFromHtml(html);
    if (fromImgTag) {
      candidates.push(fromImgTag);
    }
    candidates.push(...extractUrlsFromText(html));
  }

  const uriList = dataTransfer.getData("text/uri-list");
  if (uriList) {
    candidates.push(
      ...uriList
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#")),
    );
  }

  const plainText = dataTransfer.getData("text/plain").trim();
  if (plainText.length > 0) {
    const markdownImageUrl = extractMarkdownImageUrl(plainText);
    if (markdownImageUrl) {
      candidates.push(markdownImageUrl);
    }
    candidates.push(...extractUrlsFromText(plainText));
    candidates.push(plainText);
  }

  return pickBestCandidate(candidates);
}
