import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/board-result")({
  head: () => ({ meta: [{ title: "বোর্ড রেজাল্ট — স্মার্ট নোয়াখালী" }, { name: "description", content: "শিক্ষা বোর্ডের ফলাফল দেখুন" }] }),
  component: BoardResult,
});

const links = [
  { label: "শিক্ষা বোর্ড বাংলাদেশ", url: "https://www.educationboardresults.gov.bd/" },
  { label: "এসএসসি ফলাফল", url: "https://eboardresults.com/" },
  { label: "এইচএসসি ফলাফল", url: "https://eboardresults.com/" },
];

function BoardResult() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> হোম</Link>
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-card p-4 shadow-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="h-6 w-6" /></div>
        <div>
          <h1 className="font-display text-lg font-bold text-primary-deep">বোর্ড রেজাল্ট</h1>
          <p className="text-xs text-muted-foreground">নিচের লিংক থেকে ফলাফল দেখুন</p>
        </div>
      </div>
      <div className="grid gap-3">
        {links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl bg-gradient-card p-4 shadow-card transition hover:shadow-elevated">
            <span className="font-semibold">{l.label}</span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
}