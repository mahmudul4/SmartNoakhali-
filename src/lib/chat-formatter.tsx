import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface FormattedChatMessageProps {
  text: string;
  isUser?: boolean;
}

interface Block {
  type: "code" | "text";
  language?: string;
  content: string;
}

export function FormattedChatMessage({ text, isUser = false }: FormattedChatMessageProps) {
  if (!text) return null;

  // Split into code blocks and normal text blocks
  const blocks: Block[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }
    blocks.push({
      type: "code",
      language: match[1]?.trim() || "code",
      content: match[2]?.replace(/\n$/, "") || "",
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    blocks.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return (
    <div className="space-y-2 leading-relaxed text-xs sm:text-sm">
      {blocks.map((block, bIdx) => {
        if (block.type === "code") {
          return (
            <CodeBlockCard
              key={`code_${bIdx}`}
              language={block.language || "code"}
              code={block.content}
            />
          );
        }

        const lines = block.content.split("\n");
        return (
          <div key={`txt_block_${bIdx}`} className="space-y-1.5">
            {lines.map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={`empty_${idx}`} className="h-1" />;
              }

              // Heading check
              if (trimmed.startsWith("### ")) {
                return (
                  <h4 key={idx} className="font-bold text-sm text-primary-deep mt-2">
                    {parseLineSpans(trimmed.replace(/^###\s+/, ""), isUser)}
                  </h4>
                );
              }
              if (trimmed.startsWith("## ")) {
                return (
                  <h3 key={idx} className="font-extrabold text-sm text-primary-deep mt-2.5">
                    {parseLineSpans(trimmed.replace(/^##\s+/, ""), isUser)}
                  </h3>
                );
              }
              if (trimmed.startsWith("# ")) {
                return (
                  <h2 key={idx} className="font-black text-base text-primary-deep mt-3">
                    {parseLineSpans(trimmed.replace(/^#\s+/, ""), isUser)}
                  </h2>
                );
              }

              // Bullet points
              const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("* ");
              const numMatch = trimmed.match(/^(\d+)[.)]\s+/);
              const isNumbered = Boolean(numMatch);

              if (isBullet || isNumbered) {
                const bulletSymbol = isNumbered ? `${numMatch![1]}.` : "•";
                const content = isNumbered
                  ? trimmed.slice(numMatch![0].length)
                  : trimmed.replace(/^[•\-*]\s*/, "");

                return (
                  <div key={idx} className="flex items-start gap-1.5 pl-1">
                    <span className={`select-none font-bold shrink-0 ${isUser ? "text-gold" : "text-primary"}`}>
                      {bulletSymbol}
                    </span>
                    <div className="flex-1 break-words">
                      {parseLineSpans(content, isUser)}
                    </div>
                  </div>
                );
              }

              return (
                <div key={idx} className="break-words">
                  {parseLineSpans(line, isUser)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function CodeBlockCard({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950 text-slate-100 shadow-md">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
        <span className="uppercase tracking-wider font-semibold text-emerald-400">{language}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1 hover:text-white transition px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
          title="কোড কপি করুন"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans">কপি হয়েছে</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span className="font-sans">কপি</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto text-[11px] sm:text-xs font-mono leading-relaxed text-slate-200 scrollbar-thin">
        <pre className="m-0 p-0 font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function parseLineSpans(lineText: string, isUser: boolean): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let remaining = lineText;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // 1. Markdown link: [label](url)
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

    // 2. Bold: **text**
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

    // 3. Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push(
        <code
          key={`c_${keyIndex++}`}
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
            isUser
              ? "bg-white/25 text-white"
              : "bg-muted text-rose-600 dark:text-rose-400 border border-border/60"
          }`}
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 4. Raw Bangladeshi phone numbers: 01[3-9]\d{2}[-\s]?\d{6} or emergency 999 or 333
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
    const nextSpecial = remaining.search(/\[|\*\*|`|01[3-9]|999|333/);
    if (nextSpecial === -1) {
      tokens.push(<span key={`txt_${keyIndex++}`}>{remaining}</span>);
      break;
    } else if (nextSpecial === 0) {
      tokens.push(<span key={`txt_${keyIndex++}`}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    } else {
      tokens.push(<span key={`txt_${keyIndex++}`}>{remaining.slice(0, nextSpecial)}</span>);
      remaining = remaining.slice(nextSpecial);
    }
  }

  return tokens;
}
