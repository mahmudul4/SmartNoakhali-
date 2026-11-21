/**
 * Smart Noakhali — Shared SVG Sanitizer
 * Sanitizes SVG markup with DOMParser, removing scripts, event handlers,
 * javascript:/vbscript:/data:text/html URLs, foreignObject, and unsafe elements.
 */

export function sanitizeSvgMarkup(rawSvg: string): {
  ok: boolean;
  sanitized?: string;
  error?: string;
} {
  try {
    const trimmed = String(rawSvg || "").trim();
    if (!trimmed) {
      return { ok: false, error: "SVG ফাইলটি খালি।" };
    }
    if (trimmed.length > 250000) {
      return { ok: false, error: "SVG ফাইলটি ২৫০ KB-এর বেশি বড় হতে পারবে না।" };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, "image/svg+xml");
    const parseErr = doc.querySelector("parsererror");
    if (parseErr) {
      return { ok: false, error: "SVG ফাইলটির ফরম্যাট বৈধ নয়।" };
    }

    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== "svg") {
      return { ok: false, error: "বৈধ <svg> রুট এলিমেন্ট পাওয়া যায়নি।" };
    }

    const forbiddenTags = new Set([
      "script",
      "foreignobject",
      "iframe",
      "object",
      "embed",
      "link",
      "meta",
      "base",
      "audio",
      "video",
    ]);

    const walkAndClean = (node: Element) => {
      const children = Array.from(node.children);
      for (const child of children) {
        const tag = child.tagName.toLowerCase();
        if (forbiddenTags.has(tag)) {
          child.remove();
          continue;
        }
        if (tag === "style") {
          const css = child.textContent || "";
          if (/expression\s*\(|javascript:|@import|behavior\s*:/i.test(css)) {
            child.remove();
            continue;
          }
        }
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          const nameLow = attr.name.toLowerCase();
          const valClean = attr.value.replace(/[\u0000-\u0020]+/g, "").toLowerCase();
          if (nameLow.startsWith("on")) {
            child.removeAttribute(attr.name);
            continue;
          }
          if (
            (nameLow === "href" ||
              nameLow === "xlink:href" ||
              nameLow === "src" ||
              nameLow === "action" ||
              nameLow === "formaction") &&
            (valClean.startsWith("javascript:") ||
              valClean.startsWith("vbscript:") ||
              valClean.startsWith("data:text/html"))
          ) {
            child.removeAttribute(attr.name);
            continue;
          }
          if (nameLow === "style" && /expression\s*\(|javascript:|@import/i.test(attr.value)) {
            child.removeAttribute(attr.name);
          }
        }
        walkAndClean(child);
      }
    };

    for (const attr of Array.from(root.attributes)) {
      const nameLow = attr.name.toLowerCase();
      if (nameLow.startsWith("on")) {
        root.removeAttribute(attr.name);
      }
    }
    walkAndClean(root);

    const serializer = new XMLSerializer();
    const cleanSvg = serializer.serializeToString(root);
    return { ok: true, sanitized: cleanSvg };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "SVG স্যানিটাইজ করতে সমস্যা হয়েছে।",
    };
  }
}
