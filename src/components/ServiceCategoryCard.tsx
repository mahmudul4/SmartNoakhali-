import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Category } from "@/data/categories";

interface IconTheme {
  badgeClasses: string;
  iconClass: string;
  glossClass: string;
  bottomTintClass: string;
}

function getIconTheme(category: Category): IconTheme {
  const t = `${category.tint || ""} ${category.divisionId || ""} ${category.slug || ""}`.toLowerCase();

  if (t.includes("rose") || t.includes("red") || t.includes("blood") || t.includes("emergency")) {
    return {
      badgeClasses:
        "bg-gradient-to-br from-rose-50 via-rose-100/95 to-rose-200 ring-1 ring-rose-300/75 shadow-[inset_0_2px_1px_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(225,29,72,0.14),0_6px_12px_-4px_rgba(225,29,72,0.24)]",
      iconClass: "text-rose-600",
      glossClass: "from-white/80 to-transparent",
      bottomTintClass: "bg-rose-400/20",
    };
  }
  if (t.includes("orange") || t.includes("amber") || t.includes("yellow") || t.includes("food")) {
    return {
      badgeClasses:
        "bg-gradient-to-br from-amber-50 via-amber-100/95 to-orange-200/90 ring-1 ring-amber-300/75 shadow-[inset_0_2px_1px_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(217,119,6,0.14),0_6px_12px_-4px_rgba(217,119,6,0.22)]",
      iconClass: "text-amber-700",
      glossClass: "from-white/80 to-transparent",
      bottomTintClass: "bg-amber-400/20",
    };
  }
  if (t.includes("cyan") || t.includes("sky") || t.includes("transport") || t.includes("tech")) {
    return {
      badgeClasses:
        "bg-gradient-to-br from-sky-50 via-sky-100/95 to-cyan-200/90 ring-1 ring-sky-300/75 shadow-[inset_0_2px_1px_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(2,132,199,0.14),0_6px_12px_-4px_rgba(2,132,199,0.22)]",
      iconClass: "text-sky-700",
      glossClass: "from-white/80 to-transparent",
      bottomTintClass: "bg-sky-400/20",
    };
  }
  if (t.includes("blue") || t.includes("indigo")) {
    return {
      badgeClasses:
        "bg-gradient-to-br from-blue-50 via-indigo-100/95 to-indigo-200/90 ring-1 ring-indigo-300/75 shadow-[inset_0_2px_1px_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(67,56,202,0.14),0_6px_12px_-4px_rgba(67,56,202,0.22)]",
      iconClass: "text-indigo-700",
      glossClass: "from-white/80 to-transparent",
      bottomTintClass: "bg-indigo-400/20",
    };
  }
  if (t.includes("purple") || t.includes("violet") || t.includes("pink") || t.includes("events")) {
    return {
      badgeClasses:
        "bg-gradient-to-br from-purple-50 via-purple-100/95 to-fuchsia-200/90 ring-1 ring-purple-300/75 shadow-[inset_0_2px_1px_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(126,34,206,0.14),0_6px_12px_-4px_rgba(126,34,206,0.21)]",
      iconClass: "text-purple-700",
      glossClass: "from-white/80 to-transparent",
      bottomTintClass: "bg-purple-400/20",
    };
  }
  if (t.includes("teal") || t.includes("health")) {
    return {
      badgeClasses:
        "bg-gradient-to-br from-teal-50 via-teal-100/95 to-emerald-200/90 ring-1 ring-teal-300/75 shadow-[inset_0_2px_1px_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(15,118,110,0.14),0_6px_12px_-4px_rgba(15,118,110,0.22)]",
      iconClass: "text-teal-700",
      glossClass: "from-white/80 to-transparent",
      bottomTintClass: "bg-teal-400/20",
    };
  }
  if (t.includes("slate") || t.includes("stone") || t.includes("zinc")) {
    return {
      badgeClasses:
        "bg-gradient-to-br from-slate-50 via-slate-100/95 to-slate-200 ring-1 ring-slate-300/80 shadow-[inset_0_2px_1px_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(51,65,85,0.12),0_6px_12px_-4px_rgba(51,65,85,0.18)]",
      iconClass: "text-slate-700",
      glossClass: "from-white/85 to-transparent",
      bottomTintClass: "bg-slate-400/20",
    };
  }

  return {
    badgeClasses:
      "bg-gradient-to-br from-emerald-50 via-emerald-100/95 to-emerald-200/90 ring-1 ring-emerald-300/75 shadow-[inset_0_2px_1px_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(4,120,87,0.14),0_6px_12px_-4px_rgba(4,120,87,0.22)]",
    iconClass: "text-emerald-700",
    glossClass: "from-white/80 to-transparent",
    bottomTintClass: "bg-emerald-400/20",
  };
}

export function CategoryIconBadge({
  category,
  size = "md",
}: {
  category: Category;
  size?: "sm" | "md" | "lg";
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const Icon = category.icon;
  const theme = getIconTheme(category);

  useEffect(() => {
    setImgFailed(false);
  }, [category.customIconUrl]);

  const showCustomIcon = Boolean(category.customIconUrl && !imgFailed);

  const boxSizes =
    size === "lg"
      ? "h-12 w-12 rounded-2xl sm:h-14 sm:w-14"
      : size === "sm"
      ? "h-8 w-8 rounded-xl"
      : "h-10 w-10 rounded-[14px] sm:h-11 sm:w-11 sm:rounded-[15px]";

  const iconSizes =
    size === "lg"
      ? "h-6 w-6 sm:h-7 sm:w-7"
      : size === "sm"
      ? "h-4 w-4"
      : "h-[19px] w-[19px] sm:h-[21px] sm:w-[21px]";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden transition-transform duration-150 group-hover:scale-105 ${boxSizes} ${
        showCustomIcon
          ? "bg-white ring-1 ring-slate-200/90 shadow-sm"
          : theme.badgeClasses
      }`}
    >
      {showCustomIcon ? (
        <img
          src={category.customIconUrl}
          alt={category.bn}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          {/* Soft-3D Top Specular Sheen */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-1 top-0.5 h-3.5 rounded-full bg-gradient-to-b ${theme.glossClass}`}
          />
          {/* Subtle 3D Bottom Anchor Glow */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -bottom-1.5 h-3.5 w-7 rounded-full blur-[3px] ${theme.bottomTintClass}`}
          />
          <Icon
            className={`relative z-10 drop-shadow-[0_1px_1px_rgba(255,255,255,0.75)] ${iconSizes} ${theme.iconClass}`}
            strokeWidth={2.2}
          />
        </>
      )}
    </div>
  );
}

export function ServiceCategoryCard({ category }: { category: Category }) {
  const cardInner = (
    <div className="group relative flex h-full min-h-[90px] w-full min-w-0 flex-col items-center justify-start rounded-2xl border border-slate-200/85 bg-white px-1.5 py-2.5 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-6px_rgba(15,23,42,0.08)] transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-400/70 hover:shadow-[0_6px_16px_-6px_rgba(15,81,50,0.18)] active:scale-[0.97] sm:min-h-[104px] sm:px-2 sm:py-3">
      <CategoryIconBadge category={category} size="md" />

      {/* Centered Bengali Category Label */}
      <span className="mt-1.5 block w-full break-words text-center font-bangla text-[10.5px] font-semibold leading-[1.25] text-slate-800 sm:mt-2 sm:text-[12px]">
        {category.bn}
      </span>
    </div>
  );

  if (category.customRoute) {
    const cleanRoute = category.customRoute.trim();
    if (cleanRoute.startsWith("/")) {
      return (
        <Link to={cleanRoute as "/"} className="flex h-full min-w-0">
          {cardInner}
        </Link>
      );
    }
    if (/^https?:\/\//i.test(cleanRoute)) {
      return (
        <a
          href={cleanRoute}
          target="_blank"
          rel="noreferrer"
          className="flex h-full min-w-0"
        >
          {cardInner}
        </a>
      );
    }
  }

  if (category.slug === "submit-info") {
    return (
      <Link to="/submit-info" className="flex h-full min-w-0">
        {cardInner}
      </Link>
    );
  }
  if (category.slug === "about") {
    return (
      <Link to="/about" className="flex h-full min-w-0">
        {cardInner}
      </Link>
    );
  }
  if (category.slug === "board-result") {
    return (
      <Link to="/board-result" className="flex h-full min-w-0">
        {cardInner}
      </Link>
    );
  }
  if (category.slug === "donation") {
    return (
      <Link to="/donation" className="flex h-full min-w-0">
        {cardInner}
      </Link>
    );
  }
  if (category.slug === "blood-donor") {
    return (
      <Link to="/blood-donor" className="flex h-full min-w-0">
        {cardInner}
      </Link>
    );
  }
  if (category.slug === "emergency-request") {
    return (
      <Link to="/emergency-request" className="flex h-full min-w-0">
        {cardInner}
      </Link>
    );
  }

  return (
    <Link
      to="/category/$slug"
      params={{ slug: category.slug }}
      className="flex h-full min-w-0"
    >
      {cardInner}
    </Link>
  );
}
