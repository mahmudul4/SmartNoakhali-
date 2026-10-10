import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Send,
  MessageCircle,
  Paperclip,
  Loader2,
  Image as ImageIcon,
  Mic,
  Square,
  Bot,
  Phone,
  Droplet,
} from "lucide-react";
import {
  ensureMyThread,
  useThreadMessages,
  markThreadRead,
  uploadPublicImage,
  useCloudSubmissions,
  useCloudDonors,
  useEmergencyRequests,
} from "@/lib/cloud";
import {
  useStaffProfiles,
  useLogo,
  useCategories,
  useDonationConfig,
  useSiteMetaConfig,
} from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { AiChatMessage } from "@/components/FloatingLiveChat";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "লাইভ চ্যাট ও এআই সহকারী — স্মার্ট নোয়াখালী" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { user, isAuthed, isStaff } = useAuth();
  const { getStaffProfile } = useStaffProfiles();
  const { logo } = useLogo();
  const { meta } = useSiteMetaConfig();
  const { categories } = useCategories();
  const { activeNumbers } = useDonationConfig();
  const subs = useCloudSubmissions();
  const donors = useCloudDonors();
  const emerg = useEmergencyRequests();

  const [mode, setMode] = useState<"ai" | "live">("live");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // AI State
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>(() => [
    {
      id: "welcome_ai_page",
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const t = await ensureMyThread(user.id);
      if (!cancelled) setThreadId(t?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (threadId && mode === "live") void markThreadRead(threadId, "user");
  }, [threadId, mode]);

  const { items, send } = useThreadMessages(threadId);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "live") endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length, mode]);

  useEffect(() => {
    if (mode === "ai") aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages.length, aiLoading, mode]);

  useEffect(() => {
    if (threadId && items.length && mode === "live") {
      void markThreadRead(threadId, "user");
    }
  }, [items.length, threadId, mode]);

  async function askAi(promptText: string) {
    const clean = promptText.trim();
    if (!clean || aiLoading) return;
    setAiMessages((prev) => [
      ...prev,
      {
        id: `u_${Date.now()}`,
        role: "user",
        text: clean,
        created_at: new Date().toISOString(),
      },
    ]);
    setAiInput("");
    setAiLoading(true);
    try {
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
            submissions: subs.items.filter((s) => s.status === "approved"),
            donors: donors.items.filter((d) => d.status === "approved"),
            emergencyRequests: emerg.items.filter((e) => e.status === "approved"),
            donationNumbers: activeNumbers,
          },
        }),
      });
      const data = await resp.json();
      setAiMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          text: data.reply || "দুঃখিত, এই মুহূর্তে উত্তর পাওয়া যায়নি।",
          created_at: new Date().toISOString(),
          matches: data.matches,
        },
      ]);
    } catch {
      toast.error("এআই সংযোগে ত্রুটি হয়েছে");
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
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
    const url = await uploadPublicImage(file, `chat/${threadId}`);
    setBusy(false);
    if (!url) return toast.error("আপলোড ব্যর্থ");
    const { error } = await send(user.id, "user", "", url, userMeta);
    if (error) toast.error(error.message);
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-72px)] max-w-3xl flex-col px-4 pb-2 pt-4">
      <Link to="/" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> হোম
      </Link>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gradient-card p-3 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700">
            {mode === "ai" ? <Bot className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
          </div>
          <div>
            <p className="font-display font-bold text-primary-deep">
              {mode === "ai" ? "স্মার্ট এআই সহকারী" : "লাইভ চ্যাট সাপোর্ট"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {mode === "ai"
                ? "যেকোনো তথ্য বা নাম্বার নিমিষেই খুঁজে নিন"
                : "এডমিন, এডিটর ও মডারেটরের সাথে সরাসরি কথা বলুন"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode("ai")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              mode === "ai" ? "bg-card text-primary-deep shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Bot className="h-3.5 w-3.5" /> এআই সহকারী
          </button>
          <button
            type="button"
            onClick={() => setMode("live")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              mode === "live" ? "bg-card text-primary-deep shadow-sm" : "text-muted-foreground"
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" /> লাইভ চ্যাট
          </button>
        </div>
      </div>

      {mode === "ai" ? (
        <>
          <div className="flex-1 space-y-2.5 overflow-y-auto rounded-2xl border border-border bg-card/40 p-3">
            {aiMessages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                      isUser
                        ? "bg-gradient-hero text-primary-foreground"
                        : "border border-border bg-card"
                    }`}
                  >
                    <p className={`text-[10px] font-bold ${isUser ? "text-gold" : "text-primary"}`}>
                      {isUser ? "আপনি" : "স্মার্ট এআই সহকারী"}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words">{m.text}</p>

                    {m.matches?.submissions && m.matches.submissions.length > 0 && (
                      <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2">
                        {m.matches.submissions.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-primary-deep">{s.title}</p>
                              {s.address && (
                                <p className="truncate text-[11px] text-muted-foreground">
                                  📍 {s.address}
                                </p>
                              )}
                            </div>
                            {s.contact && (
                              <a
                                href={`tel:${s.contact}`}
                                className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground"
                              >
                                <Phone className="h-3 w-3" /> {s.contact}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {m.matches?.donors && m.matches.donors.length > 0 && (
                      <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2">
                        {m.matches.donors.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between gap-2 rounded-xl bg-rose-500/10 p-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-rose-900">
                                {d.full_name} ({d.blood_group})
                              </p>
                            </div>
                            <a
                              href={`tel:${d.phone}`}
                              className="flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white"
                            >
                              <Droplet className="h-3 w-3" /> {d.phone}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {aiLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> এআই তথ্য খুঁজছে...
              </div>
            )}
            <div ref={aiEndRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void askAi(aiInput);
            }}
            className="mt-2 flex items-center gap-2"
          >
            <input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="এআইকে যেকোনো প্রশ্ন করুন (যেমন: অ্যাম্বুলেন্স, রক্তদাতা, হাসপাতাল)..."
              className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              disabled={aiLoading}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shadow-elevated active:scale-95"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      ) : !isAuthed ? (
        <div className="rounded-2xl bg-gradient-card p-6 text-center shadow-card">
          <MessageCircle className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 font-display text-lg font-bold text-primary-deep">লাইভ চ্যাট সাপোর্ট</p>
          <p className="mt-1 text-xs text-muted-foreground">
            এডমিন/মডারেটরের সাথে কথা বলতে লগইন করুন অথবা উপরের "এআই সহকারী" ট্যাব ব্যবহার করুন
          </p>
          <Link
            to="/auth"
            className="mt-4 inline-block rounded-full bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevated"
          >
            লগইন
          </Link>
        </div>
      ) : isStaff ? (
        <div className="rounded-2xl bg-gradient-card p-6 text-center shadow-card">
          <MessageCircle className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 font-display text-lg font-bold text-primary-deep">
            এডমিন / স্টাফ চ্যাট ইনবক্স
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            সব ব্যবহারকারীর বার্তা দেখতে ও উত্তর দিতে এডমিন প্যানেলে যান
          </p>
          <Link
            to="/mdmahmudulhashan"
            className="mt-4 inline-block rounded-full bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevated"
          >
            এডমিন প্যানেল খুলুন
          </Link>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-2.5 overflow-y-auto rounded-2xl border border-border bg-card/40 p-3">
            {items.length === 0 && (
              <p className="py-12 text-center text-xs text-muted-foreground">
                প্রথম বার্তা পাঠান — এডমিন, এডিটর বা মডারেটর উত্তর দিলে তার নাম ও প্রোফাইল ছবি দেখতে পাবেন
              </p>
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
                  className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                >
                  {!mine && (
                    <img
                      src={staffPhoto}
                      alt={staffName}
                      className="h-8 w-8 shrink-0 rounded-full border border-primary/30 bg-white object-cover shadow-sm"
                    />
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
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
                        <span className="text-[10px] text-muted-foreground">
                          · {staffRole}
                        </span>
                      )}
                    </div>
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.attachment_url && <AttachmentView url={m.attachment_url} />}
                    <p
                      className={`mt-0.5 text-[9px] ${
                        mine ? "opacity-70" : "text-muted-foreground"
                      }`}
                    >
                      {new Date(m.created_at).toLocaleTimeString("bn-BD", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSend} className="mt-2 flex items-center gap-2">
            <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-card text-primary shadow-card">
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
              className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shadow-elevated active:scale-95">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export function AttachmentView({ url }: { url: string }) {
  const isImg = /\.(png|jpe?g|gif|webp)$/i.test(url) || url.startsWith("data:image");
  const isAudio = /\.(webm|mp3|ogg|wav|m4a)$/i.test(url) || url.startsWith("data:audio");
  if (isAudio) return <audio controls src={url} className="mt-1 h-10 w-full max-w-[240px]" />;
  if (isImg)
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block">
        <img src={url} alt="" className="max-h-48 rounded-lg" />
      </a>
    );
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex items-center gap-1 rounded bg-black/10 px-2 py-1 text-[11px]"
    >
      <ImageIcon className="h-3 w-3" /> ফাইল
    </a>
  );
}

export function VoiceRecorderButton({
  onRecorded,
  disabled,
}: {
  onRecorded: (b: Blob) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        if (blob.size > 500) onRecorded(blob);
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("মাইক্রোফোন অনুমতি দিন");
    }
  }
  function stop() {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={recording ? stop : start}
      title={recording ? "থামান" : "ভয়েস রেকর্ড"}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-card transition ${
        recording ? "animate-pulse bg-rose-600 text-white" : "bg-card text-primary"
      }`}
    >
      {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </button>
  );
}
