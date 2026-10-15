import React from "react";

interface FormattedChatMessageProps {
  text: string;
  isUser?: boolean;
}

export function FormattedChatMessage({ text, isUser = false }: FormattedChatMessageProps) {
  if (!text) return null;

  // Split lines
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 leading-relaxed text-xs sm:text-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("* ");
        const content = isBullet ? trimmed.replace(/^[•\-*]\s*/, "") : line;

        return (
          <div key={idx} className={isBullet ? "flex items-start gap-1.5 pl-1" : ""}>
            {isBullet && (
              <span className={`select-none font-bold ${isUser ? "text-gold" : "text-primary"}`}>
                •
              </span>
            )}
            <div className="flex-1 break-words">
              {parseLineSpans(content, isUser)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parseLineSpans(lineText: string, isUser: boolean): React.ReactNode[] {
  // Regex pattern for [label](url) and **bold**
  // Tokenize
  const tokens: React.ReactNode[] = [];
  let remaining = lineText;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // 1. Check for markdown link: [label](url)
    const linkMatch = remaining.match(/^\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const label = linkMatch[1];
      const url = linkMatch[2];
      const isTel = url.startsWith("tel:");
      tokens.push(
        <a
          key={`link_${keyIndex++}`}
          href={url}
          className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-bold underline underline-offset-2 transition ${
            isUser
              ? "bg-white/20 text-white hover:bg-white/30"
              : isTel
              ? "bg-primary/10 text-primary-deep hover:bg-primary/20"
              : "text-primary hover:underline"
          }`}
          target={isTel ? "_self" : "_blank"}
          rel="noopener noreferrer"
        >
          {label}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // 2. Check for bold: **text**
    const boldMatch = remaining.match(/^\*\*(.*?)\*\*/);
    if (boldMatch) {
      tokens.push(
        <strong key={`b_${keyIndex++}`} className={`font-bold ${isUser ? "text-gold" : "text-primary-deep"}`}>
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 3. Check for raw Bangladeshi phone numbers: e.g. 01[3-9]\d{2}[-\s]?\d{6} or 999 or 333
    const phoneMatch = remaining.match(/^(?:📞\s*)?(01[3-9]\d{2}[-\s]?\d{6}|999|333)\b/);
    if (phoneMatch) {
      const rawNumber = phoneMatch[1];
      const cleanTel = rawNumber.replace(/\D/g, "");
      tokens.push(
        <a
          key={`ph_${keyIndex++}`}
          href={`tel:${cleanTel}`}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold transition ${
            isUser
              ? "bg-white/20 text-white hover:bg-white/30"
              : "bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300"
          }`}
        >
          📞 {rawNumber}
        </a>
      );
      remaining = remaining.slice(phoneMatch[0].length);
      continue;
    }

    // Normal text slice up to next token indicator
    const nextSpecial = remaining.search(/\[|\*\*|01[3-9]|999|333/);
    if (nextSpecial === -1) {
      tokens.push(<span key={`txt_${keyIndex++}`}>{remaining}</span>);
      break;
    } else if (nextSpecial === 0) {
      // Advance by 1 char if no full match
      tokens.push(<span key={`txt_${keyIndex++}`}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    } else {
      tokens.push(<span key={`txt_${keyIndex++}`}>{remaining.slice(0, nextSpecial)}</span>);
      remaining = remaining.slice(nextSpecial);
    }
  }

  return tokens;
}
