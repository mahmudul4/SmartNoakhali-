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
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  LogIn,
  User as UserIcon,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
import {
  useStaffProfiles,
  useLogo,
  useCategories,
  useDonationConfig,
  useSiteMetaConfig,
} from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { auth, ensureFirebaseAuthUser } from "@/lib/firebase";
import { toast } from "sonner";
import type { AiChatMessage } from "@/components/FloatingLiveChat";
import { FormattedChatMessage } from "@/lib/chat-formatter";
import { resolveStaffMessageRole } from "@/lib/chat-roles";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "লাইভ চ্যাট ও এআই সহকারী — স্মার্ট নোয়াখালী" }] }),
  component: ChatPage,
});

export function playChatChime(type: "send" | "receive" = "send") {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === "send") {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.14);
    } else {
      osc.frequency.setValueAtTime(780, now);
      osc.frequency.exponentialRampToValueAtTime(1040, now + 0.12);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // audio policy
  }
}

function getOrCreateGuestId(): string {
  try {
    let id = localStorage.getItem("sn_guest_chat_id_v1");
    if (!id) {
      id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem("sn_guest_chat_id_v1", id);
    }
    return id;
  } catch {
    return `guest_${Date.now()}`;
  }
}

const QUICK_PROMPTS = [
  "🚑 জরুরী অ্যাম্বুলেন্স ও হাসপাতাল",
  "🩸 রক্তদাতা খুঁজুন (O+ / B+ / A+)",
  "🚒 ফায়ার সার্ভিস ও পুলিশ স্টেশন",
  "🏥 নোয়াখালী জেনারেল হাসপাতাল",
  "📞 জরুরি হটলাইন ৯৯৯ ও ৩৩৩",
  "🤝 অনুদান ও বিকাশ নাম্বার",
];

function ChatPage() {
  const { user, isAuthed, isStaff, isMainAdmin, isAdmin, isEditor, isModerator } = useAuth();
  const { getStaffProfile } = useStaffProfiles();
  const { logo } = useLogo();
  const { meta } = useSiteMetaConfig();
  const { categories } = useCategories();
  const { activeNumbers } = useDonationConfig();
  const subs = useCloudSubmissions();
  const donors = useCloudDonors();
  const emerg = useEmergencyRequests();
  const threadsHook = useChatThreads();

  const [mode, setMode] = useState<"ai" | "live">("ai");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Staff specific state
  const [staffSelectedThread, setStaffSelectedThread] = useState<string | null>(null);
  const [staffTab, setStaffTab] = useState<"inbox" | "chat">("chat");

  // Guest Chat State
  const [guestName, setGuestName] = useState(() => localStorage.getItem("sn_guest_name_v1") || "");
  const [guestPhone, setGuestPhone] = useState(() => localStorage.getItem("sn_guest_phone_v1") || "");
  const [showGuestMetaEdit, setShowGuestMetaEdit] = useState(false);

  // AI State
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>(() => [
    {
      id: "welcome_ai_page",
      role: "assistant",
      text:
        meta.aiWelcomeMessage ||
        "আসসালামু আলাইকুম! আমি স্মার্ট নোয়াখালী এআই সহকারী। ডাক্তার, হাসপাতাল, অ্যাম্বুলেন্স, ফায়ার সার্ভিস, রক্তদাতা বা যেকোনো জরুরি নাম্বার খুঁজতে আমাকে প্রশ্ন করুন!",
      created_at: new Date().toISOString(),
    },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);

  // Active Thread ID Calculation
  const [activeUid, setActiveUid] = useState<string>(() => {
    return auth.currentUser?.uid || user?.id || localStorage.getItem("sn_guest_chat_id_v1") || "";
  });

  useEffect(() => {
    void ensureFirebaseAuthUser().then((fbUser) => {
      const resolved = user?.id || fbUser?.uid;
      if (resolved) {
        setActiveUid(resolved);
        try {
          localStorage.setItem("sn_guest_chat_id_v1", resolved);
        } catch {}
      }
    });
  }, [user]);

  const effectiveThreadId = isStaff && staffSelectedThread
    ? staffSelectedThread
    : user
    ? user.id
    : activeUid || getOrCreateGuestId();

  function resetAiChat() {
    setAiMessages([
      {
        id: "welcome_ai_page",
        role: "assistant",
        text:
          meta.aiWelcomeMessage ||
          "আসসালামু আলাইকুম! আমি স্মার্ট নোয়াখালী এআই সহকারী। ডাক্তার, হাসপাতাল, জরুরি সেবা, সাধারণ জ্ঞান, কোডিং বা গণিতসহ যেকোনো বিষয়ে আমাকে প্রশ্ন করতে পারেন!",
        created_at: new Date().toISOString(),
      },
    ]);
    toast.success("নতুন এআই চ্যাট শুরু হয়েছে!");
  }

  useEffect(() => {
    setThreadId(effectiveThreadId);
    if (user) {
      void ensureMyThread(user.id);
    }
  }, [user, effectiveThreadId]);

  useEffect(() => {
    if (threadId && mode === "live") void markThreadRead(threadId, isStaff ? "staff" : "user");
  }, [threadId, mode, isStaff]);

  const { items, send } = useThreadMessages(threadId);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "live") endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length, mode]);

  useEffect(() => {
    if (mode === "ai") aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages.length, aiLoading, mode]);

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
    if (soundEnabled) playChatChime("send");
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
      const data = await resp.json().catch(() => ({}));
      const replyText =
        data.text ||
        data.reply ||
        `স্মার্ট নোয়াখালী এআই সহকারী: আপনার অনুসন্ধানের জন্য নিচের জরুরি যোগাযোগ:\n• জাতীয় জরুরি সেবা: 📞 [999](tel:999)\n• নোয়াখালী জেনারেল হাসপাতাল: 📞 [01730-324794](tel:01730324794)\n• নোয়াখালী ফায়ার সার্ভিস: 📞 [01730-002444](tel:01730002444)\n• সুধারাম মডেল থানা: 📞 [01320-116035](tel:01320116035)\n\nসরাসরি এডমিনের সাথে কথা বলতে উপরের 'লাইভ প্রতিনিধি' ট্যাবে মেসেজ দিন।`;

      setAiMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          text: replyText,
          created_at: new Date().toISOString(),
          matches: data.matches,
        },
      ]);
      if (soundEnabled) playChatChime("receive");
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `fallback_${Date.now()}`,
          role: "assistant",
          text: `স্মার্ট নোয়াখালী এআই সহকারী: জরুরি যোগাযোগের জন্য:\n• জরুরি হটলাইন: 📞 [999](tel:999)\n• নোয়াখালী জেনারেল হাসপাতাল: 📞 [01730-324794](tel:01730324794)\n• নোয়াখালী ফায়ার সার্ভিস: 📞 [01730-002444](tel:01730002444)\n\nঅথবা 'লাইভ প্রতিনিধি' অপশনে ক্লিক করে সরাসরি সাপোর্ট টিমের সাথে কথা বলুন।`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  function handleCopy(textToCopy: string, id: string) {
    void navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    toast.success("বার্তা কপি করা হয়েছে!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function clearAiChat() {
    setAiMessages([
      {
        id: `welcome_${Date.now()}`,
        role: "assistant",
        text: "চ্যাট হিস্ট্রি রিসেট করা হয়েছে। নোয়াখালী জেলার যেকোনো তথ্য জানতে আমাকে প্রশ্ন করুন!",
        created_at: new Date().toISOString(),
      },
    ]);
    toast.info("এআই চ্যাট নতুন করে শুরু করা হয়েছে");
  }

  const effectiveUserName = user?.displayName || guestName || "অতিথি গ্রাহক";
  const effectiveUserPhone = user?.phone || guestPhone || "";

  const senderRoleLabel = isStaff
    ? isMainAdmin
      ? "সুপার অ্যাডমিন"
      : isAdmin
      ? "অ্যাডমিন"
      : isEditor
      ? "এডিটর"
      : isModerator
      ? "মডারেটর"
      : "স্টাফ"
    : "গ্রাহক";

  const effectiveSenderName = isStaff
    ? isMainAdmin
      ? "সুপার অ্যাডমিন"
      : user?.displayName || "অ্যাডমিন সাপোর্ট"
    : effectiveUserName;

  const userMeta = {
    user_name: effectiveUserName,
    user_email: isStaff && isMainAdmin ? undefined : user?.email || undefined,
    user_phone: isStaff && isMainAdmin ? undefined : effectiveUserPhone || undefined,
    sender_name: effectiveSenderName,
    sender_role_label: senderRoleLabel,
  };

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !threadId) return;
    setText("");
    const role = isStaff ? "staff" : "user";
    const senderId = user?.id || threadId;
    if (soundEnabled) playChatChime("send");
    const { error } = await send(senderId, role, t, undefined, userMeta);
    if (error) toast.error(error.message);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !threadId) return;
    setBusy(true);
    const url = await uploadPublicImage(f, `chat/${threadId}`);
    setBusy(false);
    if (!url) return toast.error("আপলোড ব্যর্থ");
    const role = isStaff ? "staff" : "user";
    const senderId = user?.id || threadId;
    if (soundEnabled) playChatChime("send");
    const { error } = await send(senderId, role, "", url, userMeta);
    if (error) toast.error(error.message);
  }

  async function onVoice(blob: Blob) {
    if (!threadId) return;
    setBusy(true);
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
    const url = await uploadPublicImage(file, `chat/${threadId}`);
    setBusy(false);
    if (!url) return toast.error("আপলোড ব্যর্থ");
    const role = isStaff ? "staff" : "user";
    const senderId = user?.id || threadId;
    if (soundEnabled) playChatChime("send");
    const { error } = await send(senderId, role, "", url, userMeta);
    if (error) toast.error(error.message);
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-72px)] max-w-3xl flex-col px-3 pb-2 pt-3 sm:px-4">
      {/* Header bar */}
      <div className="mb-2.5 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> হোম পেজ
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
            title={soundEnabled ? "শব্দ বন্ধ করুন" : "শব্দ চালু করুন"}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-emerald-600" /> : <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="hidden sm:inline">{soundEnabled ? "শব্দ চালু" : "নিঃশব্দ"}</span>
          </button>
          {mode === "ai" && (
            <button
              type="button"
              onClick={clearAiChat}
              className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
              title="নতুন চ্যাট শুরু করুন"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">নতুন চ্যাট</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Switcher Card */}
      <div className="mb-3 rounded-2xl bg-gradient-card p-3 shadow-card ring-1 ring-border/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-sm">
              {mode === "ai" ? <Sparkles className="h-5 w-5 text-gold" /> : <MessageCircle className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display font-bold text-primary-deep text-sm sm:text-base">
                  {mode === "ai" ? "স্মার্ট এআই সহকারী" : "সরাসরি লাইভ চ্যাট"}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  সক্রিয়
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {mode === "ai"
                  ? "ডাক্তার, হাসপাতাল, অ্যাম্বুলেন্স ও সেবা সহজে খুঁজুন"
                  : "এডমিন ও মডারেটরদের সাথে তাৎক্ষণিক যোগাযোগ করুন"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-muted/80 p-1">
            <button
              type="button"
              onClick={() => setMode("ai")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === "ai"
                  ? "bg-card text-primary-deep shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bot className="h-3.5 w-3.5" /> এআই সহকারী
            </button>
            <button
              type="button"
              onClick={() => setMode("live")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === "live"
                  ? "bg-card text-primary-deep shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" /> লাইভ চ্যাট
            </button>
          </div>
        </div>

        {/* Staff mode banner or guest banner if live chat */}
        {mode === "live" && isStaff && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-1.5 text-xs text-primary-deep">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              আপনি স্টাফ হিসেবে যুক্ত আছেন
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStaffTab(staffTab === "inbox" ? "chat" : "inbox")}
                className="rounded-lg bg-card px-2.5 py-1 text-[11px] font-bold text-primary shadow-sm ring-1 ring-border"
              >
                {staffTab === "inbox" ? "💬 চ্যাট উইন্ডো দেখুন" : "📥 ইউজার ইনবক্স খুলুন"}
              </button>
            </div>
          </div>
        )}

        {mode === "live" && !isAuthed && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs text-amber-950">
            <div className="flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5 text-amber-700" />
              <span>
                অতিথি চ্যাট: <strong>{guestName || "অতিথি গ্রাহক"}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowGuestMetaEdit(!showGuestMetaEdit)}
                className="rounded-lg bg-card px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow-sm ring-1 ring-border"
              >
                {showGuestMetaEdit ? "বন্ধ করুন" : "নাম/ফোন সেট করুন"}
              </button>
              <Link
                to="/auth"
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-sm"
              >
                <LogIn className="h-3 w-3" /> লগইন করুন
              </Link>
            </div>
          </div>
        )}

        {showGuestMetaEdit && mode === "live" && !isAuthed && (
          <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl bg-card p-2.5 sm:grid-cols-2 ring-1 ring-border">
            <input
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                localStorage.setItem("sn_guest_name_v1", e.target.value);
              }}
              placeholder="আপনার নাম লিখুন..."
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
            />
            <input
              value={guestPhone}
              onChange={(e) => {
                setGuestPhone(e.target.value);
                localStorage.setItem("sn_guest_phone_v1", e.target.value);
              }}
              placeholder="আপনার ফোন নম্বর (ঐচ্ছিক)..."
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
            />
          </div>
        )}
      </div>

      {mode === "ai" ? (
        <>
          {/* Quick Prompts with Reset Button */}
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-gold" /> দ্রুত সেবা প্রশ্ন
            </span>
            <button
              type="button"
              onClick={resetAiChat}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-primary transition"
              title="নতুন এআই চ্যাট শুরু করুন"
            >
              <RotateCcw className="h-3 w-3" /> নতুন চ্যাট
            </button>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5 overflow-x-auto pb-1">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp}
                type="button"
                onClick={() => void askAi(qp)}
                className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary-deep transition hover:bg-primary/15 active:scale-95 whitespace-nowrap"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* AI Messages View */}
          <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card/50 p-3.5 shadow-inner">
            {aiMessages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`group relative max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      isUser
                        ? "bg-gradient-hero text-primary-foreground"
                        : "border border-border bg-card text-foreground"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        {!isUser && <Bot className="h-3.5 w-3.5 text-primary" />}
                        <span className={`text-[10px] font-bold ${isUser ? "text-gold" : "text-primary"}`}>
                          {isUser ? "আপনি" : "স্মার্ট এআই সহকারী"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(m.text, m.id)}
                        className={`rounded p-1 opacity-0 transition group-hover:opacity-100 ${
                          isUser ? "hover:bg-white/15 text-white/90" : "hover:bg-muted text-muted-foreground"
                        }`}
                        title="বার্তা কপি করুন"
                      >
                        {copiedId === m.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>

                    <FormattedChatMessage text={m.text} isUser={isUser} />

                    {/* Matched Submissions */}
                    {m.matches?.submissions && m.matches.submissions.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-border/70 pt-2.5">
                        <p className="text-[10px] font-bold text-muted-foreground">সরাসরি যোগাযোগের তথ্য:</p>
                        {m.matches.submissions.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 p-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-primary-deep">{s.title}</p>
                              {s.designation && <p className="truncate text-[10px] text-muted-foreground">{s.designation}</p>}
                              {s.address && <p className="truncate text-[10px] text-muted-foreground">📍 {s.address}</p>}
                            </div>
                            {s.contact && (
                              <a
                                href={`tel:${s.contact}`}
                                className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-sm"
                              >
                                <Phone className="h-3 w-3" /> {s.contact}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Matched Donors */}
                    {m.matches?.donors && m.matches.donors.length > 0 && (
                      <div className="mt-2.5 space-y-1.5 border-t border-border/70 pt-2">
                        <p className="text-[10px] font-bold text-rose-800">রক্তদাতা ও যোগাযোগের তালিকা:</p>
                        {m.matches.donors.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between gap-2 rounded-xl bg-rose-500/10 p-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-rose-900">
                                {d.full_name}{" "}
                                <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                                  {d.blood_group}
                                </span>
                              </p>
                              {d.address && <p className="truncate text-[10px] text-muted-foreground">📍 {d.address}</p>}
                            </div>
                            <a
                              href={`tel:${d.phone}`}
                              className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
                            >
                              <Droplet className="h-3 w-3" /> কল দিন
                            </a>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Matched Categories */}
                    {m.matches?.categories && m.matches.categories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-border/70 pt-2">
                        {m.matches.categories.map((c) => (
                          <Link
                            key={c.slug}
                            to="/category/$slug"
                            params={{ slug: c.slug }}
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
              <div className="flex items-center gap-2 rounded-xl bg-card border border-border p-2.5 text-xs text-muted-foreground w-fit">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> এআই তথ্য অনুসন্ধান করছে...
              </div>
            )}
            <div ref={aiEndRef} />
          </div>

          {/* AI Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void askAi(aiInput);
            }}
            className="mt-2.5 flex items-center gap-2"
          >
            <input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="এআইকে যেকোনো প্রশ্ন করুন (যেমন: অ্যাম্বুলেন্স, রক্তদাতা, হাসপাতাল)..."
              className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-primary shadow-sm"
            />
            <button
              disabled={aiLoading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shadow-elevated active:scale-95 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      ) : isStaff && staffTab === "inbox" ? (
        /* Staff Inbox Overview */
        <div className="flex-1 space-y-2.5 overflow-y-auto rounded-2xl border border-border bg-card/50 p-3 shadow-inner">
          <div className="flex items-center justify-between pb-1 border-b border-border">
            <p className="font-bold text-xs text-primary-deep">সকল গ্রাহক চ্যাট ইনবক্স ({threadsHook.items.length})</p>
            <span className="text-[11px] text-muted-foreground">ক্লিক করে উত্তর দিন</span>
          </div>
          {threadsHook.items.length === 0 && (
            <p className="py-12 text-center text-xs text-muted-foreground">কোনো অপেক্ষমাণ চ্যাট নেই</p>
          )}
          {threadsHook.items.map((t) => {
            const isSelected = staffSelectedThread === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setStaffSelectedThread(t.id);
                  setStaffTab("chat");
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                  isSelected ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-xs text-foreground truncate">{t.user_name || "গ্রাহক"}</p>
                    {t.staff_unread > 0 && (
                      <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-extrabold text-white">
                        {t.staff_unread} নতুন
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                    {t.last_message_preview || "বার্তা..."}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(t.last_message_at).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary">
                    চ্যাট খুলুন →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* Live Chat Messages View */
        <>
          <div className="flex-1 space-y-2.5 overflow-y-auto rounded-2xl border border-border bg-card/50 p-3.5 shadow-inner">
            {items.length === 0 && (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <MessageCircle className="mx-auto h-8 w-8 text-primary/50" />
                <p className="text-xs font-semibold">আপনার প্রথম বার্তা পাঠান</p>
                <p className="text-[11px]">এডমিন, এডিটর বা মডারেটর সরাসরি আপনার বার্তার উত্তর দেবেন।</p>
              </div>
            )}
            {items.map((m) => {
              const mine = isStaff ? m.sender_role === "staff" : m.sender_role === "user";
              const staffSender = !mine ? getStaffProfile(m.sender_id) : null;
              const staffRole = resolveStaffMessageRole(m) || m.sender_role_label || staffSender?.role_label || "অ্যাডমিন";
              const isSuperStaff = staffRole === "সুপার অ্যাডমিন" || m.sender_id === "super_admin_mahmudul";
              const staffName = isSuperStaff
                ? "সুপার অ্যাডমিন"
                : m.sender_name || staffSender?.full_name || "অ্যাডমিন সাপোর্ট";
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
                    className={`group relative max-w-[82%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm shadow-sm ${
                      mine
                        ? "bg-gradient-hero text-primary-foreground"
                        : "border border-border bg-card text-foreground"
                    }`}
                  >
                    <div className="mb-0.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold ${mine ? "text-gold" : "text-primary-deep"}`}>
                          {mine ? "আপনি" : staffName}
                        </span>
                        {!mine && <span className="text-[10px] text-muted-foreground">· {staffRole}</span>}
                      </div>
                      {m.body && (
                        <button
                          type="button"
                          onClick={() => handleCopy(m.body || "", m.id)}
                          className={`rounded p-0.5 opacity-0 transition group-hover:opacity-100 ${
                            mine ? "hover:bg-white/15 text-white/90" : "hover:bg-muted text-muted-foreground"
                          }`}
                          title="কপি করুন"
                        >
                          {copiedId === m.id ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                        </button>
                      )}
                    </div>
                    {m.body && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>}
                    {m.attachment_url && <AttachmentView url={m.attachment_url} />}
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px]">
                      <span className={mine ? "opacity-75" : "text-muted-foreground"}>
                        {new Date(m.created_at).toLocaleTimeString("bn-BD", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {mine && (
                        <span className="flex items-center gap-0.5 text-[9px]">
                          {m.status === "sending" && (
                            <span className="opacity-75 animate-pulse">পাঠানো হচ্ছে...</span>
                          )}
                          {m.status === "failed" && (
                            <span className="text-red-300 font-bold">ব্যর্থ</span>
                          )}
                          {(!m.status || m.status === "sent") && (
                            <span className="text-gold font-bold">✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={onSend} className="mt-2.5 flex items-center gap-2">
            <label className="flex h-11 w-11 cursor-pointer shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-card border border-border hover:bg-muted transition">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
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
              placeholder="আপনার বার্তা লিখুন..."
              maxLength={2000}
              className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-primary shadow-sm"
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shadow-elevated active:scale-95 disabled:opacity-60"
            >
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
  if (isAudio) return <audio controls src={url} className="mt-1 h-9 w-full max-w-[240px]" />;
  if (isImg)
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1.5 block">
        <img src={url} alt="" className="max-h-48 rounded-lg object-cover ring-1 ring-border shadow-sm" />
      </a>
    );
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-black/10 px-2.5 py-1 text-xs font-semibold"
    >
      <ImageIcon className="h-3.5 w-3.5" /> ফাইল দেখুন
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
      toast.error("মাইক্রোফোনের অনুমতি দিন");
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
      title={recording ? "রেকর্ডিং থামান" : "ভয়েস রেকর্ড"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-card border border-border transition ${
        recording ? "animate-pulse bg-rose-600 text-white" : "bg-card text-primary hover:bg-muted"
      }`}
    >
      {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
