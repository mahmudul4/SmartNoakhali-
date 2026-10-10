import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  MessageCircle,
  X,
  Send,
  Paperclip,
  Loader2,
  Maximize2,
  ShieldCheck,
  LogIn,
  Bot,
  Phone,
  Droplet,
  User as UserIcon,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  useCategories,
  useDonationConfig,
  useStaffProfiles,
  useSiteMetaConfig,
  useLogo,
} from "@/lib/store";
import {
  ensureMyThread,
  useThreadMessages,
  useChatThreads,
  markThreadRead,
  uploadPublicImage,
  useCloudSubmissions,
  useCloudDonors,
  useEmergencyRequests,
} from "@/lib/cloud";
import { AttachmentView, VoiceRecorderButton } from "@/routes/chat";

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
  matches?: {
    submissions?: Array<{
      id: string;
      category_slug: string;
      title: string;
      contact: string | null;
      address: string | null;
      designation: string | null;
    }>;
    donors?: Array<{
      id: string;
      full_name: string;
      phone: string;
      blood_group: string;
      address: string | null;
    }>;
    categories?: Array<{
      slug: string;
      bn: string;
      description: string;
    }>;
  };
}

const QUICK_AI_PROMPTS = [
  "🚑 জরুরী অ্যাম্বুলেন্স নাম্বার",
  "🩸 রক্তদাতা (O+ / B+) খুঁজুন",
  "🏥 হাসপাতাল ও ডাক্তার তালিকা",
  "🚒 ফায়ার সার্ভিস ও পুলিশ",
];

export function FloatingLiveChat() {
  const { user, isAuthed, isStaff, signInWithGoogle } = useAuth();
  const { getStaffProfile } = useStaffProfiles();
  const { logo } = useLogo();
  const { meta } = useSiteMetaConfig();
  const { categories } = useCategories();
  const { activeNumbers } = useDonationConfig();
  const subs = useCloudSubmissions();
  const donors = useCloudDonors();
  const emerg = useEmergencyRequests();

  const [open, setOpen] = useState(false);
  const [chatMode, setChatMode] = useState<"ai" | "live">("ai");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // AI Conversation State
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>(() => [
    {
      id: "welcome_ai",
      role: "assistant",
      text:
        meta.aiWelcomeMessage ||
        "আসসালামু আলাইকুম! আমি স্মার্ট নোয়াখালী এআই সহকারী। ডাক্তার, হাসপাতাল, অ্যাম্বুলেন্স, ফায়ার সার্ভিস, রক্তদাতা বা যেকোনো নাম্বার খুঁজতে আমাকে প্রশ্ন করুন!",
      created_at: new Date().toISOString(),
    },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);

  const threadsHook = useChatThreads();

  // Ensure user's own chat thread when logged in as regular user
  useEffect(() => {
    if (!user || isStaff) return;
    let cancelled = false;
    (async () => {
      const t = await ensureMyThread(user.id);
      if (!cancelled) setThreadId(t?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isStaff]);

  const { items, send } = useThreadMessages(
    open && chatMode === "live" && !isStaff ? threadId : null
  );

  useEffect(() => {
    if (open && chatMode === "live" && threadId && !isStaff) {
      void markThreadRead(threadId, "user");
    }
  }, [open, chatMode, threadId, items.length, isStaff]);

  useEffect(() => {
    if (open && chatMode === "live") {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, chatMode, items.length]);

  useEffect(() => {
    if (open && chatMode === "ai") {
      aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, chatMode, aiMessages.length, aiLoading]);

  const unreadCount = isStaff
    ? threadsHook.items.reduce((sum, t) => sum + (Number(t.staff_unread) || 0), 0)
    : threadsHook.items.reduce((sum, t) => sum + (Number(t.user_unread) || 0), 0);

  async function askAi(promptText: string) {
    const clean = promptText.trim();
    if (!clean || aiLoading) return;

    const userMsg: AiChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      text: clean,
      created_at: new Date().toISOString(),
    };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput("");
    setAiLoading(true);

    try {
      const approvedSubs = subs.items
        .filter((s) => s.status === "approved")
        .map((s) => ({
          id: s.id,
          category_slug: s.category_slug,
          title: s.title,
          contact: s.contact,
          address: s.address,
          designation: s.designation,
          body: s.body,
        }));

      const approvedDonors = donors.items
        .filter((d) => d.status === "approved")
        .map((d) => ({
          id: d.id,
          full_name: d.full_name,
          phone: d.phone,
          blood_group: d.blood_group,
          address: d.address,
          total_donations: d.total_donations,
        }));

      const resp = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: clean,
          history: aiMessages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          directoryContext: {
            categories: categories.map((c) => ({
              slug: c.slug,
              bn: c.bn,
              en: c.en,
              description: c.description,
            })),
            submissions: approvedSubs,
            donors: approvedDonors,
            emergencyRequests: emerg.items.filter((e) => e.status === "approved"),
            donationNumbers: activeNumbers.map((n) => ({
              label: n.label,
              number: n.number,
              method: n.method,
            })),
          },
        }),
      });

      const data = await resp.json();
      const replyMsg: AiChatMessage = {
        id: `a_${Date.now()}`,
        role: "assistant",
        text: data.reply || "দুঃখিত, এই মুহূর্তে উত্তর পাওয়া যায়নি।",
        created_at: new Date().toISOString(),
        matches: data.matches,
      };
      setAiMessages((prev) => [...prev, replyMsg]);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          text: "নেটওয়ার্ক ত্রুটির কারণে উত্তর লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন বা 'লাইভ চ্যাট' ট্যাবে মেসেজ দিন।",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  const userMeta = user
    ? {
        user_name: user.displayName || undefined,
        user_email: user.email || undefined,
        user_phone: user.phone || undefined,
        sender_name: user.displayName || user.email?.split("@")[0] || "গ্রাহক",
      }
    : undefined;

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !user || !threadId) return;
    setText("");
    const { error } = await send(user.id, "user", t, undefined, userMeta);
    if (error) toast.error(error.message);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !user || !threadId) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("৫MB-এর বেশি না");
    setBusy(true);
    const url = await uploadPublicImage(f, `chat/${threadId}`);
    setBusy(false);
    if (!url) return toast.error("আপলোড ব্যর্থ");
    const { error } = await send(user.id, "user", "", url, userMeta);
    if (error) toast.error(error.message);
  }

  async function onVoice(blob: Blob) {
    if (!user || !threadId) return;
    setBusy(true);
    const file = new File([blob], `voice-${Date.now()}.webm`, {
      type: "audio/webm",
    });
    const url = await uploadPublicImage(file, `chat/${threadId}`);
    setBusy(false);
    if (!url) return toast.error("আপলোড ব্যর্থ");
    const { error } = await send(user.id, "user", "", url, userMeta);
    if (error) toast.error(error.message);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-[490px] w-[calc(100vw-1.5rem)] max-w-[375px] flex-col overflow-hidden rounded-3xl border border-primary/25 bg-card shadow-elevated">
          {/* Header */}
          <div className="bg-gradient-hero px-4 pt-3 pb-2.5 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                  {chatMode === "ai" ? (
                    <Bot className="h-5 w-5 text-gold" />
                  ) : (
                    <MessageCircle className="h-5 w-5 text-gold" />
                  )}
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-primary-deep" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold leading-tight">
                    {chatMode === "ai" ? "স্মার্ট এআই ও লাইভ সাপোর্ট" : "লাইভ চ্যাট সাপোর্ট"}
                  </p>
                  <p className="text-[10px] opacity-85">
                    {chatMode === "ai"
                      ? "যেকোনো তথ্য নিমিষেই খুঁজে নিন"
                      : "এডমিন, এডিটর ও মডারেটর সাপোর্ট"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to={isStaff && chatMode === "live" ? "/mdmahmudulhashan" : "/chat"}
                  onClick={() => setOpen(false)}
                  title="পূর্ণ স্ক্রিনে খুলুন"
                  className="rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                >
                  <Maximize2 className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  title="বন্ধ করুন"
                  className="rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mode Switcher: AI Assistant vs Live Support */}
            <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl bg-black/20 p-1">
              <button
                type="button"
                onClick={() => setChatMode("ai")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                  chatMode === "ai"
                    ? "bg-white text-primary-deep shadow-sm"
                    : "text-white/85 hover:text-white"
                }`}
              >
                <Bot className="h-3.5 w-3.5" /> এআই দিয়ে খুঁজুন
              </button>
              <button
                type="button"
                onClick={() => setChatMode("live")}
                className={`relative flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                  chatMode === "live"
                    ? "bg-white text-primary-deep shadow-sm"
                    : "text-white/85 hover:text-white"
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5" /> লাইভ চ্যাট
                {unreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-extrabold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Body: AI Mode */}
          {chatMode === "ai" ? (
            <>
              <div className="flex-1 space-y-2.5 overflow-y-auto bg-background/60 p-3">
                {/* Quick AI Search Prompts */}
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_AI_PROMPTS.map((qp) => (
                    <button
                      key={qp}
                      type="button"
                      onClick={() => void askAi(qp)}
                      className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary-deep transition hover:bg-primary/15"
                    >
                      {qp}
                    </button>
                  ))}
                </div>

                {aiMessages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                          isUser
                            ? "bg-gradient-hero text-primary-foreground"
                            : "border border-border bg-card text-foreground"
                        }`}
                      >
                        <div className="mb-0.5 flex items-center gap-1.5">
                          {!isUser && <Bot className="h-3.5 w-3.5 text-primary" />}
                          <span
                            className={`text-[10px] font-bold ${
                              isUser ? "text-gold" : "text-primary"
                            }`}
                          >
                            {isUser ? "আপনি" : "স্মার্ট এআই সহকারী"}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                          {m.text}
                        </p>

                        {/* Clickable Matched Submissions */}
                        {m.matches?.submissions && m.matches.submissions.length > 0 && (
                          <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                            {m.matches.submissions.map((s) => (
                              <div
                                key={s.id}
                                className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-bold text-primary-deep">
                                    {s.title}
                                  </p>
                                  {s.designation && (
                                    <p className="truncate text-[10px] text-muted-foreground">
                                      {s.designation}
                                    </p>
                                  )}
                                  {s.address && (
                                    <p className="truncate text-[10px] text-muted-foreground">
                                      📍 {s.address}
                                    </p>
                                  )}
                                </div>
                                {s.contact && (
                                  <a
                                    href={`tel:${s.contact}`}
                                    className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground"
                                  >
                                    <Phone className="h-3 w-3" /> কল
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Clickable Matched Blood Donors */}
                        {m.matches?.donors && m.matches.donors.length > 0 && (
                          <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                            {m.matches.donors.map((d) => (
                              <div
                                key={d.id}
                                className="flex items-center justify-between gap-2 rounded-xl bg-rose-500/10 p-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-bold text-rose-900">
                                    {d.full_name}{" "}
                                    <span className="font-extrabold text-rose-600">
                                      ({d.blood_group})
                                    </span>
                                  </p>
                                  {d.address && (
                                    <p className="truncate text-[10px] text-muted-foreground">
                                      📍 {d.address}
                                    </p>
                                  )}
                                </div>
                                <a
                                  href={`tel:${d.phone}`}
                                  className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-bold text-white"
                                >
                                  <Droplet className="h-3 w-3" /> কল
                                </a>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Clickable Matched Categories */}
                        {m.matches?.categories && m.matches.categories.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1 border-t border-border/60 pt-2">
                            {m.matches.categories.map((c) => (
                              <Link
                                key={c.slug}
                                to="/category/$slug"
                                params={{ slug: c.slug }}
                                onClick={() => setOpen(false)}
                                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary-deep"
                              >
                                {c.bn} <ChevronRight className="h-3 w-3" />
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      এআই তথ্য খুঁজছে...
                    </div>
                  </div>
                )}
                <div ref={aiEndRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void askAi(aiInput);
                }}
                className="flex items-center gap-1.5 border-t border-border bg-card p-2.5"
              >
                <input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="যেকোনো তথ্য বা নাম্বার খুঁজুন..."
                  className="min-w-0 flex-1 rounded-full border border-border bg-background px-3.5 py-2 text-xs outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={aiLoading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shadow-card active:scale-95 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </>
          ) : !isAuthed ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageCircle className="h-7 w-7" />
              </div>
              <p className="font-display text-base font-bold text-primary-deep">
                সরাসরি লাইভ চ্যাটে স্বাগতম!
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                এডমিন, এডিটর বা মডারেটরের সাথে সরাসরি কথা বলতে লগইন করুন। অথবা লগইন ছাড়াই উপরের "এআই দিয়ে খুঁজুন" ট্যাব ব্যবহার করুন!
              </p>
              <button
                type="button"
                onClick={() =>
                  void signInWithGoogle().catch((e) =>
                    toast.error(e?.message || "লগইন ব্যর্থ")
                  )
                }
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-hero py-2.5 text-xs font-bold text-primary-foreground shadow-elevated"
              >
                <LogIn className="h-3.5 w-3.5" /> Google দিয়ে দ্রুত শুরু করুন
              </button>
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="mt-2.5 text-xs font-semibold text-primary underline"
              >
                ইমেইল দিয়ে লগইন / নিবন্ধন →
              </Link>
            </div>
          ) : isStaff ? (
            <div className="flex flex-1 flex-col justify-between p-4">
              <div className="space-y-2 overflow-y-auto">
                <div className="rounded-2xl bg-primary/5 p-3 text-center">
                  <ShieldCheck className="mx-auto h-7 w-7 text-primary" />
                  <p className="mt-1 font-display text-sm font-bold text-primary-deep">
                    স্টাফ চ্যাট ইনবক্স
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    অপেক্ষমাণ অপঠিত বার্তা: {unreadCount} টি
                  </p>
                </div>
                {threadsHook.items.slice(0, 4).map((t) => (
                  <Link
                    key={t.id}
                    to="/mdmahmudulhashan"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-xl border border-border bg-background p-2.5 text-left transition hover:border-primary"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        ইউজার #{t.user_id.slice(0, 8)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {t.last_message_preview || "বার্তা দেখুন"}
                      </p>
                    </div>
                    {t.staff_unread > 0 && (
                      <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {t.staff_unread}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
              <Link
                to="/mdmahmudulhashan"
                onClick={() => setOpen(false)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-hero py-2.5 text-xs font-bold text-primary-foreground shadow-elevated"
              >
                এডমিন প্যানেলে সব চ্যাট ও উত্তর দিন →
              </Link>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-2.5 overflow-y-auto bg-background/60 p-3">
                {items.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-card/80 p-5 text-center text-xs text-muted-foreground">
                    আপনার যেকোনো প্রশ্ন বা জরুরী তথ্যের জন্য বার্তা লিখুন — এডমিন/মডারেটর উত্তর দিলে তার নাম ও ছবি এখানে দেখতে পাবেন।
                  </div>
                )}
                {items.map((m) => {
                  const mine = m.sender_role === "user";
                  const staffSender = !mine ? getStaffProfile(m.sender_id) : null;
                  const staffName = m.sender_name || staffSender?.full_name || "এডমিন সাপোর্ট";
                  const staffRole = m.sender_role_label || staffSender?.role_label || "এডমিন";
                  const staffPhoto = m.sender_photo || staffSender?.photo_url || logo;

                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 ${
                        mine ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!mine && (
                        <img
                          src={staffPhoto}
                          alt={staffName}
                          className="h-7 w-7 shrink-0 rounded-full border border-primary/30 bg-white object-cover shadow-sm"
                        />
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                          mine
                            ? "bg-gradient-hero text-primary-foreground"
                            : "border border-border bg-card"
                        }`}
                      >
                        <div className="mb-0.5 flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold ${
                              mine ? "text-gold" : "text-primary-deep"
                            }`}
                          >
                            {mine ? "আপনি" : staffName}
                          </span>
                          {!mine && (
                            <span className="text-[9px] font-semibold text-muted-foreground">
                              · {staffRole}
                            </span>
                          )}
                        </div>
                        {m.body && (
                          <p className="whitespace-pre-wrap break-words">
                            {m.body}
                          </p>
                        )}
                        {m.attachment_url && (
                          <AttachmentView url={m.attachment_url} />
                        )}
                        <p
                          className={`mt-0.5 text-[9px] ${
                            mine ? "opacity-75" : "text-muted-foreground"
                          }`}
                        >
                          {new Date(m.created_at).toLocaleTimeString("bn-BD", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {mine && (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                          <UserIcon className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <form
                onSubmit={onSend}
                className="flex items-center gap-1.5 border-t border-border bg-card p-2.5"
              >
                <label
                  title="ছবি বা ফাইল যুক্ত করুন"
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted text-primary transition hover:bg-primary/10"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={onFile}
                  />
                </label>
                <VoiceRecorderButton onRecorded={onVoice} disabled={busy} />
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="বার্তা লিখুন..."
                  maxLength={2000}
                  className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shadow-card active:scale-95"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Floating Action Button (Bottom-Right) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="লাইভ চ্যাট ও এআই"
        className="group relative flex items-center gap-2 rounded-full bg-gradient-hero px-4 py-3 text-primary-foreground shadow-elevated ring-2 ring-gold/70 transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          {open ? (
            <X className="h-5 w-5 text-gold" />
          ) : (
            <>
              <MessageCircle className="h-5 w-5 text-gold" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-primary-deep" />
            </>
          )}
        </span>
        <span className="font-display text-xs font-bold tracking-wide text-white">
          লাইভ চ্যাট ও AI
        </span>
        {unreadCount > 0 && !open && (
          <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-extrabold text-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
