import { useEffect, useState, type CSSProperties } from "react";

export type HeroDeviceBreakpoint = "desktop" | "tablet" | "mobile";

export type HeroEditableElementId =
  | "badge"
  | "heading"
  | "description"
  | "primaryButton"
  | "secondaryButton"
  | "optionalButton"
  | "optionalText";

export interface HeroElementPosition {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  maxWidthPx: number;
  textAlign: "left" | "center" | "right";
  fontScale: number;
  paddingPx: number;
}

export interface HeroBreakpointLayout {
  mode: "flow" | "custom";
  elementSpacingPx: number;
  elements: Record<HeroEditableElementId, HeroElementPosition>;
}

export type HeroResponsiveLayouts = Partial<Record<HeroDeviceBreakpoint, HeroBreakpointLayout>>;

export const HERO_ELEMENT_IDS: HeroEditableElementId[] = [
  "badge",
  "heading",
  "description",
  "primaryButton",
  "secondaryButton",
  "optionalButton",
  "optionalText",
];

export const HERO_ELEMENT_LABELS_BN: Record<HeroEditableElementId, string> = {
  badge: "টপ ব্যাজ",
  heading: "মূল শিরোনাম",
  description: "বিবরণ টেক্সট",
  primaryButton: "প্রাইমারি বাটন (#১)",
  secondaryButton: "সেকেন্ডারি বাটন (#২)",
  optionalButton: "৩য় বাটন (ঐচ্ছিক)",
  optionalText: "অতিরিক্ত টেক্সট",
};

export function clampNumber(value: number, min: number, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function roundStep(value: number, decimals = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function clampElementPosition(
  raw: Partial<HeroElementPosition>,
  fallback: HeroElementPosition
): HeroElementPosition {
  const widthPercent = roundStep(
    clampNumber(typeof raw.widthPercent === "number" ? raw.widthPercent : fallback.widthPercent, 14, 96),
    1
  );
  // Keep xPercent inside safe content boundary so element doesn't clip off right edge
  const maxAllowedX = Math.max(4, Math.min(88, 98 - Math.min(widthPercent, 60) * 0.35));
  const xPercent = roundStep(
    clampNumber(typeof raw.xPercent === "number" ? raw.xPercent : fallback.xPercent, 2, maxAllowedX),
    1
  );
  const yPercent = roundStep(
    clampNumber(typeof raw.yPercent === "number" ? raw.yPercent : fallback.yPercent, 2, 88),
    1
  );
  const maxWidthPx = Math.round(
    clampNumber(typeof raw.maxWidthPx === "number" ? raw.maxWidthPx : fallback.maxWidthPx, 120, 1100)
  );
  const textAlign =
    raw.textAlign === "left" || raw.textAlign === "center" || raw.textAlign === "right"
      ? raw.textAlign
      : fallback.textAlign;
  const fontScale = roundStep(
    clampNumber(typeof raw.fontScale === "number" ? raw.fontScale : fallback.fontScale, 0.7, 1.6),
    2
  );
  const paddingPx = Math.round(
    clampNumber(typeof raw.paddingPx === "number" ? raw.paddingPx : fallback.paddingPx, 0, 28)
  );

  return {
    xPercent,
    yPercent,
    widthPercent,
    maxWidthPx,
    textAlign,
    fontScale,
    paddingPx,
  };
}

export function createDefaultBreakpointLayout(
  device: HeroDeviceBreakpoint,
  defaultAlign: "left" | "center" | "right" = "left"
): HeroBreakpointLayout {
  const isMobile = device === "mobile";
  const isTablet = device === "tablet";
  const baseX = defaultAlign === "center" ? 12 : defaultAlign === "right" ? 16 : 5;
  const blockW = isMobile ? 90 : defaultAlign === "center" ? 76 : isTablet ? 74 : 62;

  return {
    mode: "flow",
    elementSpacingPx: isMobile ? 8 : 12,
    elements: {
      badge: {
        xPercent: defaultAlign === "center" ? 20 : baseX,
        yPercent: isMobile ? 6 : 8,
        widthPercent: isMobile ? 86 : 60,
        maxWidthPx: isMobile ? 320 : 520,
        textAlign: defaultAlign,
        fontScale: 1,
        paddingPx: 0,
      },
      heading: {
        xPercent: baseX,
        yPercent: isMobile ? 18 : 20,
        widthPercent: blockW,
        maxWidthPx: isMobile ? 340 : 720,
        textAlign: defaultAlign,
        fontScale: 1,
        paddingPx: 0,
      },
      description: {
        xPercent: baseX,
        yPercent: isMobile ? 45 : 49,
        widthPercent: isMobile ? 90 : isTablet ? 72 : 58,
        maxWidthPx: isMobile ? 340 : 660,
        textAlign: defaultAlign,
        fontScale: 1,
        paddingPx: 0,
      },
      primaryButton: {
        xPercent: defaultAlign === "center" ? 16 : baseX,
        yPercent: isMobile ? 69 : 71,
        widthPercent: isMobile ? 42 : 24,
        maxWidthPx: 260,
        textAlign: "center",
        fontScale: 1,
        paddingPx: 0,
      },
      secondaryButton: {
        xPercent: isMobile ? 50 : defaultAlign === "center" ? 44 : 26,
        yPercent: isMobile ? 69 : 71,
        widthPercent: isMobile ? 44 : 26,
        maxWidthPx: 280,
        textAlign: "center",
        fontScale: 1,
        paddingPx: 0,
      },
      optionalButton: {
        xPercent: isMobile ? 5 : defaultAlign === "center" ? 68 : 49,
        yPercent: isMobile ? 83 : 71,
        widthPercent: isMobile ? 44 : 24,
        maxWidthPx: 260,
        textAlign: "center",
        fontScale: 1,
        paddingPx: 0,
      },
      optionalText: {
        xPercent: baseX,
        yPercent: isMobile ? 86 : 87,
        widthPercent: isMobile ? 90 : 64,
        maxWidthPx: isMobile ? 330 : 620,
        textAlign: defaultAlign,
        fontScale: 1,
        paddingPx: 0,
      },
    },
  };
}

export function normalizeResponsiveLayouts(
  raw: unknown,
  defaultAlign: "left" | "center" | "right" = "left"
): HeroResponsiveLayouts | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const input = raw as Record<string, unknown>;
  const out: HeroResponsiveLayouts = {};
  const devices: HeroDeviceBreakpoint[] = ["desktop", "tablet", "mobile"];

  for (const device of devices) {
    const devRaw = input[device];
    if (!devRaw || typeof devRaw !== "object") continue;
    const dObj = devRaw as Record<string, unknown>;
    const defaults = createDefaultBreakpointLayout(device, defaultAlign);
    const mode: "flow" | "custom" = dObj.mode === "custom" ? "custom" : "flow";
    const rawElements =
      dObj.elements && typeof dObj.elements === "object"
        ? (dObj.elements as Record<string, unknown>)
        : {};

    // Skip storing unmodified "flow" presets to keep Firestore JSON compact
    if (mode === "flow" && Object.keys(rawElements).length === 0) {
      continue;
    }

    const normalizedElements = {} as Record<HeroEditableElementId, HeroElementPosition>;
    for (const elId of HERO_ELEMENT_IDS) {
      const elRaw = rawElements[elId];
      normalizedElements[elId] = clampElementPosition(
        elRaw && typeof elRaw === "object" ? (elRaw as Partial<HeroElementPosition>) : {},
        defaults.elements[elId]
      );
    }

    out[device] = {
      mode,
      elementSpacingPx: Math.round(
        clampNumber(
          typeof dObj.elementSpacingPx === "number"
            ? dObj.elementSpacingPx
            : defaults.elementSpacingPx,
          0,
          48
        )
      ),
      elements: normalizedElements,
    };
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function resolveBreakpointLayout(
  responsiveLayouts: HeroResponsiveLayouts | undefined,
  device: HeroDeviceBreakpoint,
  fallbackAlign: "left" | "center" | "right" = "left"
): HeroBreakpointLayout {
  const defaults = createDefaultBreakpointLayout(device, fallbackAlign);
  const stored = responsiveLayouts?.[device];
  if (!stored) return defaults;

  const elements = {} as Record<HeroEditableElementId, HeroElementPosition>;
  for (const id of HERO_ELEMENT_IDS) {
    elements[id] = clampElementPosition(stored.elements?.[id] || {}, defaults.elements[id]);
  }
  return {
    mode: stored.mode === "custom" ? "custom" : "flow",
    elementSpacingPx: Math.round(
      clampNumber(stored.elementSpacingPx ?? defaults.elementSpacingPx, 0, 48)
    ),
    elements,
  };
}

export function getElementCanvasStyle(
  pos: HeroElementPosition,
  zIndex = 20
): CSSProperties {
  return {
    position: "absolute",
    left: `${pos.xPercent}%`,
    top: `${pos.yPercent}%`,
    width: `${pos.widthPercent}%`,
    maxWidth: `${pos.maxWidthPx}px`,
    textAlign: pos.textAlign,
    padding: pos.paddingPx > 0 ? `${pos.paddingPx}px` : undefined,
    zIndex,
  };
}

export function useHeroBreakpoint(): HeroDeviceBreakpoint {
  const getBp = (): HeroDeviceBreakpoint => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w < 768) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  };

  const [bp, setBp] = useState<HeroDeviceBreakpoint>(getBp);

  useEffect(() => {
    const update = () => {
      const next = getBp();
      setBp((prev) => (prev === next ? prev : next));
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  return bp;
}
