import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Category } from "@/data/categories";

function isEmergencyCategory(category: Category): boolean {
  const t = `${category.divisionId || ""} ${category.slug || ""}`.toLowerCase();
  return t.includes("blood") || t.includes("emergency") || t.includes("ambulance");
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
  const isEmergency = isEmergencyCategory(category);

  const cleanIconUrl =
    typeof category.customIconUrl === "string" &&
    category.customIconUrl.trim() &&
    !/^blob:/i.test(category.customIconUrl.trim())
      ? category.customIconUrl.trim()
      : "";

  useEffect(() => {
    setImgFailed(false);
  }, [cleanIconUrl, category.iconCleared]);

  const showCustomIcon = Boolean(
    !category.iconCleared && cleanIconUrl && !imgFailed
  );

  const boxSizes =
    size === "lg"
      ? "h-12 w-12 rounded-[12px] p-1.5 sm:h-14 sm:w-14"
      : size === "sm"
      ? "h-8 w-8 rounded-[8px] p-1"
      : "h-10 w-10 rounded-[10px] p-1.5 sm:h-11 sm:w-11";

  const iconSizes =
    size === "lg"
      ? "h-6 w-6 sm:h-7 sm:w-7"
      : size === "sm"
      ? "h-4 w-4"
      : "h-5 w-5 sm:h-[22px] sm:w-[22px]";

  return (
    <div
      className={`aspect-square flex shrink-0 items-center justify-center overflow-hidden border border-[#E6E1D6] bg-[#FAF7F2] ${boxSizes}`}
    >
      {showCustomIcon ? (
        <img
          key={cleanIconUrl}
          src={cleanIconUrl}
          alt={category.bn}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setImgFailed(true)}
          className="h-full w-full object-contain select-none"
        />
      ) : (
        <Icon
          className={`${iconSizes} ${isEmergency ? "text-[#C62828]" : "text-[#0F4D3A]"}`}
          strokeWidth={1.5}
        />
      )}
    </div>
  );
}

export function ServiceCategoryCard({ category }: { category: Category }) {
  const cardInner = (
    <div className="group flex h-full min-h-[90px] w-full min-w-0 flex-col items-center justify-start rounded-[12px] border border-[#E6E1D6] bg-[#FFFFFF] px-2 py-3 text-center transition-colors hover:border-[#0F4D3A] sm:min-h-[104px] sm:px-2.5 sm:py-3.5">
      <CategoryIconBadge category={category} size="md" />

      {/* Centered Bengali Category Label */}
      <span className="mt-2 block w-full break-words text-center font-bangla text-[11px] font-medium leading-[1.3] text-[#1C1C1C] sm:text-[12.5px]">
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
