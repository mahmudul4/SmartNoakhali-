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
  Headphones,
  Search,
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
  handoffAiToLiveChat,
} from "@/lib/cloud";
import {
  useStaffProfiles,
  useLogo,
  useCategories,
  useDonationConfig,
  useSiteMetaConfig,
  useAiChatConfig,
} from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { auth, ensureFirebaseAuthUser } from "@/lib/firebase";
import { toast } from "sonner";
import type { AiChatMessage } from "@/components/FloatingLiveChat";
import { FormattedChatMessage } from "@/lib/chat-formatter";
import { resolveStaffMessageRole } from "@/lib/chat-roles";
import { useRolePermissions, resolveUserRoleDisplay } from "@/lib/permissions";

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
  const { user, isAuthed, isStaff, isMainAdmin, roles } = useAuth();
  const { customRoles, hasPermission } = useRolePermissions();
  const { getStaffProfile } = useStaffProfiles();
  const { logo } = useLogo();
  const { meta } = useSiteMetaConfig();
  const { aiConfig } = useAiChatConfig();
  const { categories } = useCategories();
  const { activeNumbers } = useDonationConfig();
  const subs = useCloudSubmissions();
  const donors = useCloudDonors();
  const emerg = useEmergencyRequests();
  const threadsHook = useChatThreads();

  const [mode, setMode] = useState<"ai" | "live">(() => (aiConfig.enabled ? "ai" : "live"));
  const [threadId, setThreadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Staff specific state
  const [staffSelectedThread, setStaffSelectedThread] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");

  // Guest Chat State
  const [guestName, setGuestName] = useState(() => localStorage.getItem("sn_guest_name_v1") || "");
  const [guestPhone, setGuestPhone] = useState(() => localStorage.getItem("sn_guest_phone_v1") || "");
  const [showGuestMetaEdit, setShowGuestMetaEdit] = useState(false);

  // AI State
  const [aiMessages, setAiMessages] = useState<Array<AiChatMessage & { suggestHandoff?: boolean }>>(() => [
    {
      id: "welcome_ai_page",
      role: "assistant",
      text:
        aiConfig.welcomeMessage ||
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

  const canViewAllChats = isMainAdmin || hasPermission("chat_view_all");
  const canReplyChat = !isStaff || isMainAdmin || hasPermission("chat_reply");

  const visibleStaffThreads = isStaff
    ? (canViewAllChats
        ? threadsHook.items
        : threadsHook.items.filter(
            (t) =>
              Boolean(t.assigned_to_uid) &&
              (t.assigned_to_uid === user?.id || t.assigned_to_uid === activeUid)
          )
      ).filter((t) => {
        const q = staffSearch.trim().toLowerCase();
        if (!q) return true;
        return [t.user_name, t.user_email, t.last_message_preview, t.assigned_to_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
    : [];

  useEffect(() => {
    if (isStaff && mode === "live" && !staffSelectedThread && visibleStaffThreads.length > 0) {
      setStaffSelectedThread(visibleStaffThreads[0].id);
    }
  }, [isStaff, mode, staffSelectedThread, visibleStaffThreads]);

  const effectiveThreadId =
    isStaff && staffSelectedThread
      ? staffSelectedThread
      : isStaff && visibleStaffThreads.length > 0
        ? visibleStaffThreads[0].id
        : user
          ? user.id
          : activeUid || getOrCreateGuestId();

  function resetAiChat() {
    setAiMessages([
      {
        id: "welcome_ai_page",
        role: "assistant",
        text:
          aiConfig.welcomeMessage ||
          meta.aiWelcomeMessage ||
          "আসসালামু আলাইকুম! আমি স্মার্ট নোয়াখালী এআই সহকারী। ডাক্তার, হাসপাতাল, জরুরি সেবা বা নাগরিক তথ্য জানতে আমাকে প্রশ্ন করুন!",
        created_at: new Date().toISOString(),
      },
    ]);
    toast.success("নতুন এআই চ্যাট শুরু হয়েছে!");
  }

  async function handleHandoffToLiveChat() {
    const targetThread = effectiveThreadId;
    if (!targetThread || handoffBusy) return;
    setHandoffBusy(true);
    try {
      const recentQueries = aiMessages
        .filter((m) => m.id !== "welcome_ai_page")
        .slice(-4)
        .map((m) => `${m.role === "user" ? "গ্রাহক" : "AI"}: ${m.text.slice(0, 140)}`)
        .join("\n");
      const summary = recentQueries || "গ্রাহক সরাসরি হিউম্যান সাপোর্টের সাথে কথা বলতে চান।";
      const res = await handoffAiToLiveChat({
        threadId: targetThread,
        userId: user?.id || targetThread,
        summary,
        userName: user?.displayName || guestName || "অতিথি গ্রাহক",
        userEmail: user?.email || undefined,
        userPhone: user?.phone || guestPhone || undefined,
      });
      if (!res.ok) {
        toast.error(res.error || "হ্যান্ডঅফ করতে সমস্যা হয়েছে");
        return;
      }
      setMode("live");
      toast.success("আপনার এআই আলোচনার সারসংক্ষেপসহ সরাসরি লাইভ সাপোর্টে যুক্ত করা হয়েছে!");
    } finally {
      setHandoffBusy(false);
    }
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

  const {
    items,
    loading: msgsLoading,
    error: msgsError,
    send,
    retrySend,
    refresh: refreshMsgs,
  } = useThreadMessages(threadId);
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
          aiConfig: {
            botName: aiConfig.botName,
            systemInstructions: aiConfig.systemInstructions,
            tone: aiConfig.tone,
            faqs: aiConfig.faqs.filter((f) => f.visible !== false),
          },
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
      const baseText =
        data.fallbackText ||
        data.text ||
        data.reply ||
        `স্মার্ট নোয়াখালী এআই সহকারী: আপনার অনুসন্ধানের জন্য নিচের জরুরি যোগাযোগ:\n• জাতীয় জরুরি সেবা: 📞 [999](tel:999)\n• নোয়াখালী জেনারেল হাসপাতাল: 📞 [01730-324794](tel:01730324794)\n• নোয়াখালী ফায়ার সার্ভিস: 📞 [01730-002444](tel:01730002444)\n• সুধারাম মডেল থানা: 📞 [01320-116035](tel:01320116035)\n\nসরাসরি সাপোর্টের সাথে কথা বলতে উপরের 'হিউম্যান সাপোর্ট' বাটনে ট্যাপ করুন।`;

      const statusBanner = !resp.ok
        ? resp.status === 429
          ? "⚠️ **এআই সার্ভারে অতিরিক্ত চাপ (Rate Limit)** — তাৎক্ষণিক ডিরেক্টরি তথ্য দেখানো হচ্ছে:\n\n"
          : "ℹ️ **তাৎক্ষণিক ডিরেক্টরি অনুসন্ধান মোড** (এআই মডেল সংযোগ অনুপলব্ধ):\n\n"
        : "";

      setAiMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          text: `${statusBanner}${baseText}`,
          created_at: new Date().toISOString(),
          matches: data.matches,
          suggestHandoff: Boolean(!resp.ok || data.suggestHandoff || aiConfig.autoSuggestHandoff),
        },
      ]);
      if (soundEnabled) playChatChime("receive");
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `fallback_${Date.now()}`,
          role: "assistant",
          text: `স্মার্ট নোয়াখালী এআই সহকারী: জরুরি যোগাযোগের জন্য:\n• জরুরি হটলাইন: 📞 [999](tel:999)\n• নোয়াখালী জেনারেল হাসপাতাল: 📞 [01730-324794](tel:01730324794)\n• নোয়াখালী ফায়ার সার্ভিস: 📞 [01730-002444](tel:01730002444)\n\nঅথবা 'সরাসরি হিউম্যান সাপোর্ট' বাটনে ক্লিক করে সাপোর্ট টিমের সাথে কথা বলুন।`,
          created_at: new Date().toISOString(),
          suggestHandoff: true,
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
        text: aiConfig.welcomeMessage || "চ্যাট হিস্ট্রি রিসেট করা হয়েছে। নোয়াখালী জেলার যেকোনো তথ্য জানতে আমাকে প্রশ্ন করুন!",
        created_at: new Date().toISOString(),
      },
    ]);
    toast.info("এআই চ্যাট নতুন করে শুরু করা হয়েছে");
  }

  const effectiveUserName = user?.displayName || guestName || "অতিথি গ্রাহক";
  const effectiveUserPhone = user?.phone || guestPhone || "";

  const resolvedStaffRole = resolveUserRoleDisplay({
    email: user?.email,
    roles,
    isMainAdmin,
    customRoleId: user?.customRoleId,
    customRoleName: user?.customRoleName,
    customRoles,
  });

  const senderRoleLabel = isStaff ? resolvedStaffRole.labelBn : "গ্রাহক";

  const effectiveSenderName = isStaff
    ? isMainAdmin
      ? "সুপার অ্যাডমিন"
      : user?.displayName || resolvedStaffRole.labelBn
    : effectiveUserName;

  const activeThreadRow = threadsHook.items.find((t) => t.id === threadId);

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
    if (f.size > 25 * 1024 * 1024) {
      return toast.error("ফাইলটি ২৫ মেগাবাইটের বেশি হওয়া যাবে না");
    }
    setBusy(true);
    try {
      const url = await uploadPublicImage(f, `chat/${threadId}`);
      if (!url) return toast.error("ছবি বা ফাইল আপলোড করা যায়নি, পুনরায় চেষ্টা করুন");
      const role = isStaff ? "staff" : "user";
      const senderId = user?.id || threadId;
      if (soundEnabled) playChatChime("send");
      const { error } = await send(senderId, role, "", url, userMeta);
      if (error) toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function onVoice(blob: Blob) {
    if (!threadId) return;
    setBusy(true);
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const url = await uploadPublicImage(file, `chat/${threadId}`);
      if (!url) return toast.error("ভয়েস মেসেজ আপলোড করা যায়নি");
      const role = isStaff ? "staff" : "user";
      const senderId = user?.id || threadId;
      if (soundEnabled) playChatChime("send");
      const { error } = await send(senderId, role, "", url, userMeta);
      if (error) toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-64px)] min-h-[420px] w-full max-w-[1480px] flex-col px-1.5 py-1.5 sm:px-4 sm:py-3 lg:h-[85vh] lg:w-[88%] xl:w-[85%]">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-elevated sm:rounded-3xl">
        {/* Compact Workspace Top Bar */}
        <div
          className={`shrink-0 border-b border-border/70 px-3 py-2 sm:px-4 sm:py-2.5 ${
            mode === "ai" ? "bg-gradient-to-r from-indigo-50 via-card to-teal-50/40" : "bg-gradient-card"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
              <Link
                to="/"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-foreground"
                title="হোমে ফিরুন"
                aria-label="হোমে ফিরুন"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${
                  mode === "ai" ? "bg-gradient-to-br from-indigo-600 to-teal-600" : "bg-gradient-hero"
                }`}
              >
                {mode === "ai" ? <Sparkles className="h-4 w-4 text-amber-200" /> : <Headphones className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-sm font-bold text-primary-deep sm:text-base">
                    {mode === "ai" ? aiConfig.botName || "স্মার্ট এআই সহকারী" : "সরাসরি লাইভ চ্যাট"}
                  </p>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    সক্রিয়
                  </span>
                </div>
                <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                  {mode === "ai"
                    ? "তাৎক্ষণিক পাবলিক ডিরেক্টরি ও সেবা সহায়তা"
                    : isStaff
                      ? `${senderRoleLabel} হিসেবে সাপোর্ট ইনবক্স পরিচালিত হচ্ছে`
                      : "দায়িত্বপ্রাপ্ত হিউম্যান অপারেটরের সাথে সরাসরি যোগাযোগ"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1 rounded-xl bg-muted/80 p-1">
                <button
                  type="button"
                  onClick={() => setMode("ai")}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    mode === "ai"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bot className="h-3.5 w-3.5" /> এআই
                </button>
                <button
                  type="button"
                  onClick={() => setMode("live")}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    mode === "live"
                      ? "bg-gradient-hero text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> লাইভ চ্যাট
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="flex h-8 items-center gap-1 rounded-xl border border-border bg-card px-2 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
                title={soundEnabled ? "শব্দ বন্ধ করুন" : "শব্দ চালু করুন"}
              >
                {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-emerald-600" /> : <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>

              {mode === "ai" && (
                <button
                  type="button"
                  onClick={clearAiChat}
                  className="flex h-8 items-center gap-1 rounded-xl border border-border bg-card px-2.5 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
                  title="নতুন চ্যাট শুরু করুন"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">নতুন চ্যাট</span>
                </button>
              )}
            </div>
          </div>

          {mode === "live" && !isStaff && activeThreadRow && (activeThreadRow.status === "resolved" || activeThreadRow.status === "closed") && (
            <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-900">
              এই চ্যাটটি {activeThreadRow.status === "resolved" ? "সমাধানকৃত" : "বন্ধ"} অবস্থায় রয়েছে — নতুন মেসেজ পাঠালে স্বয়ংক্রিয়ভাবে পুনরায় চালু হবে।
            </div>
          )}

          {mode === "live" && !isAuthed && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-500/10 px-3 py-1 text-xs text-amber-950">
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
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm"
                >
                  <LogIn className="h-3 w-3" /> লগইন করুন
                </Link>
              </div>
            </div>
          )}

          {showGuestMetaEdit && mode === "live" && !isAuthed && (
            <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl bg-card p-2 sm:grid-cols-2 ring-1 ring-border">
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
          <div className="flex flex-1 min-h-0 flex-col">
            {/* Compact Quick Prompts Bar */}
            <div className="shrink-0 border-b border-indigo-100/80 bg-indigo-50/30 px-3 py-2 sm:px-4">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-900/75">
                  <Sparkles className="h-3 w-3 text-indigo-600" /> দ্রুত সেবা প্রশ্ন
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={handoffBusy}
                    onClick={() => void handleHandoffToLiveChat()}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600/15 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-600/25 transition"
                  >
                    <Headphones className="h-3 w-3" /> হিউম্যান সাপোর্ট
                  </button>
                  <button
                    type="button"
                    onClick={resetAiChat}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-primary transition"
                    title="নতুন এআই চ্যাট শুরু করুন"
                  >
                    <RotateCcw className="h-3 w-3" /> নতুন চ্যাট
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                {(aiConfig.quickPrompts.length > 0 ? aiConfig.quickPrompts : QUICK_PROMPTS).map((qp) => (
                  <button
                    key={qp}
                    type="button"
                    onClick={() => void askAi(qp)}
                    className="shrink-0 rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-900 transition hover:bg-indigo-50 active:scale-95 whitespace-nowrap"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Messages View */}
            <div className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-indigo-50/20 p-3 sm:p-5">
            {aiMessages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`group relative max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      isUser
                        ? "bg-gradient-to-r from-indigo-600 to-teal-700 text-white"
                        : "border border-indigo-100 bg-card text-foreground"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        {!isUser && <Bot className="h-3.5 w-3.5 text-indigo-600" />}
                        <span className={`text-[10px] font-bold ${isUser ? "text-amber-200" : "text-indigo-700"}`}>
                          {isUser ? "আপনি" : aiConfig.botName || "স্মার্ট এআই সহকারী"}
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

                    {/* AI -> Human Live Chat Handoff CTA */}
                    {!isUser && m.suggestHandoff && (
                      <div className="mt-2.5 border-t border-indigo-100 pt-2">
                        <p className="text-[10px] text-muted-foreground mb-1">
                          {aiConfig.handoffNotice}
                        </p>
                        <button
                          type="button"
                          disabled={handoffBusy}
                          onClick={() => void handleHandoffToLiveChat()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <Headphones className="h-3.5 w-3.5" />
                          {handoffBusy ? "যুক্ত হচ্ছে..." : "সরাসরি হিউম্যান সাপোর্টে কথা বলুন"}
                        </button>
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
              className="shrink-0 flex items-end gap-2 border-t border-border/80 bg-card px-3 py-2.5 sm:px-4"
            >
              <textarea
                rows={1}
                value={aiInput}
                onChange={(e) => {
                  setAiInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void askAi(aiInput);
                  }
                }}
                onFocus={() => setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: "smooth" }), 120)}
                placeholder="এআইকে যেকোনো প্রশ্ন করুন (অ্যাম্বুলেন্স, রক্তদাতা, হাসপাতাল)..."
                className="min-h-[42px] max-h-28 min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-hero px-4 text-xs font-bold text-primary-foreground shadow-elevated active:scale-95 disabled:opacity-60 sm:h-11"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">পাঠান</span>
              </button>
            </form>
          </div>
        ) : (
          /* Live Chat Split Workspace (Staff 2-pane on Desktop, List <-> Conversation on Mobile; Customer spacious single pane) */
          <div
            className={`flex-1 min-h-0 ${
              isStaff
                ? "grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]"
                : "flex flex-col"
            }`}
          >
            {isStaff && (
              <aside
                className={`${
                  mobileThreadOpen ? "hidden lg:flex" : "flex"
                } min-h-0 flex-col border-border/80 bg-muted/15 lg:border-r`}
              >
                <div className="shrink-0 space-y-2 border-b border-border/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-xs font-bold text-primary-deep">
                      সকল কথোপকথন ({visibleStaffThreads.length})
                    </p>
                    <Link
                      to="/mdmahmudulhashan"
                      className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold text-primary hover:bg-primary/20"
                    >
                      <ShieldCheck className="h-3 w-3" /> ফুল ড্যাশবোর্ড
                    </Link>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      placeholder="গ্রাহকের নাম বা বার্তা খুঁজুন..."
                      className="w-full rounded-xl border border-border bg-card py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto p-2.5">
                  {visibleStaffThreads.length === 0 ? (
                    <p className="py-12 text-center text-xs text-muted-foreground">
                      কোনো কথোপকথন পাওয়া যায়নি
                    </p>
                  ) : (
                    visibleStaffThreads.map((t) => {
                      const isSelected = threadId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setStaffSelectedThread(t.id);
                            setMobileThreadOpen(true);
                          }}
                          className={`flex w-full items-start justify-between gap-2.5 rounded-2xl border p-3 text-left transition ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-2xs"
                              : "border-border/70 bg-card hover:border-primary/40"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-bold text-foreground">
                                {t.user_name || t.user_email || `গ্রাহক #${t.id.slice(0, 6)}`}
                              </p>
                              {t.staff_unread > 0 && (
                                <span className="shrink-0 rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-extrabold text-white">
                                  {t.staff_unread}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {t.last_message_preview || "বার্তা..."}
                            </p>
                            {t.assigned_to_name && (
                              <p className="mt-0.5 truncate text-[10px] font-semibold text-primary">
                                দায়িত্বে: {t.assigned_to_name}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {new Date(t.last_message_at).toLocaleTimeString("bn-BD", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </aside>
            )}

            <div
              className={`${
                isStaff && !mobileThreadOpen ? "hidden lg:flex" : "flex"
              } min-h-0 flex-1 flex-col`}
            >
              {/* Compact Active Conversation Subheader for Staff */}
              {isStaff && (
                <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/20 px-3 py-2 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileThreadOpen(false)}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-bold text-foreground lg:hidden"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> তালিকা
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-primary-deep sm:text-sm">
                        {activeThreadRow?.user_name || activeThreadRow?.user_email || "গ্রাহক কথোপকথন"}
                      </p>
                      <p className="truncate text-[10.5px] text-muted-foreground">
                        {activeThreadRow?.assigned_to_name
                          ? `দায়িত্বপ্রাপ্ত: ${activeThreadRow.assigned_to_name}`
                          : "সরাসরি লাইভ সাপোর্ট"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-[10.5px] font-bold text-primary-deep">
                    {senderRoleLabel}
                  </span>
                </div>
              )}

              {/* Scrollable Message History */}
              <div className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-background/40 p-3 sm:p-5">
                {msgsError && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                    <span>{msgsError}</span>
                    <button
                      type="button"
                      onClick={() => refreshMsgs()}
                      className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white"
                    >
                      আবার লোড করুন
                    </button>
                  </div>
                )}
                {msgsLoading && items.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground space-y-2">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs">কথোপকথন লোড হচ্ছে...</p>
                  </div>
                )}
                {!msgsLoading && items.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground space-y-2">
                    <MessageCircle className="mx-auto h-8 w-8 text-primary/50" />
                    <p className="text-xs font-semibold">আপনার প্রথম বার্তা পাঠান</p>
                    <p className="text-[11px]">এডমিন, এডিটর বা মডারেটর সরাসরি আপনার বার্তার উত্তর দেবেন।</p>
                  </div>
                )}
                {items.map((m) => {
                  const mine = isStaff ? m.sender_role === "staff" : m.sender_role === "user";
                  const staffSender = !mine ? getStaffProfile(m.sender_id) : null;
                  const staffRole =
                    resolveStaffMessageRole(m) || m.sender_role_label || staffSender?.role_label || "অ্যাডমিন";
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
                        className={`group relative max-w-[85%] sm:max-w-[76%] rounded-2xl px-3.5 py-2.5 text-[13.5px] sm:text-sm shadow-sm ${
                          mine
                            ? "bg-gradient-hero text-primary-foreground"
                            : "border border-border bg-card text-foreground"
                        }`}
                      >
                        <div className="mb-0.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10.5px] font-bold ${mine ? "text-gold" : "text-primary-deep"}`}>
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
                              {copiedId === m.id ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                        {m.body && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>}
                        {m.attachment_url && <AttachmentView url={m.attachment_url} />}
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                          <span className={mine ? "opacity-80" : "text-muted-foreground"}>
                            {new Date(m.created_at).toLocaleTimeString("bn-BD", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {mine && (
                            <span className="flex items-center gap-0.5 text-[10px]">
                              {m.status === "sending" && (
                                <span className="opacity-75 animate-pulse">পাঠানো হচ্ছে...</span>
                              )}
                              {m.status === "failed" && (
                                <button
                                  type="button"
                                  onClick={() => void retrySend(m.id)}
                                  className="rounded bg-rose-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white hover:bg-rose-700"
                                >
                                  ব্যর্থ · পুনরায় পাঠান
                                </button>
                              )}
                              {(!m.status || m.status === "sent") && (
                                <span className="font-bold text-gold">✓</span>
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

              {/* Docked Multiline Chat Composer */}
              {canReplyChat ? (
                <form
                  onSubmit={onSend}
                  className="shrink-0 flex items-end gap-1.5 sm:gap-2 border-t border-border/80 bg-card px-2.5 py-2 sm:px-4 sm:py-2.5"
                >
                  <label className="flex h-10 w-10 sm:h-11 sm:w-11 cursor-pointer shrink-0 items-center justify-center rounded-full border border-border bg-background text-primary shadow-2xs transition hover:bg-muted">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={onFile}
                    />
                  </label>
                  <VoiceRecorderButton onRecorded={onVoice} disabled={busy} />
                  <textarea
                    rows={1}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void onSend(e as unknown as React.FormEvent);
                      }
                    }}
                    onFocus={() => setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 120)}
                    placeholder="আপনার বার্তা লিখুন..."
                    maxLength={2000}
                    className="min-h-[42px] max-h-28 min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={busy || !text.trim()}
                    className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-hero px-3.5 text-xs font-bold text-primary-foreground shadow-elevated active:scale-95 disabled:opacity-60 sm:h-11 sm:px-4"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">পাঠান</span>
                  </button>
                </form>
              ) : (
                <div className="shrink-0 border-t border-border bg-muted/30 px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">
                  🔒 আপনার ভূমিকায় উত্তর দেওয়ার পারমিশন (chat_reply) নেই।
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AttachmentView({ url }: { url: string }) {
  const [imgBroken, setImgBroken] = useState(false);
  const isImg = /\.(png|jpe?g|gif|webp|avif)$/i.test(url) || url.startsWith("data:image");
  const isAudio = /\.(webm|mp3|ogg|wav|m4a)$/i.test(url) || url.startsWith("data:audio");
  if (isAudio) return <audio controls src={url} className="mt-1 h-9 w-full max-w-[240px]" />;
  if (isImg && !imgBroken)
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1.5 block">
        <img
          src={url}
          alt="সংযুক্ত ছবি"
          onError={() => setImgBroken(true)}
          className="max-h-48 rounded-lg object-cover ring-1 ring-border shadow-sm"
        />
      </a>
    );
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-black/10 px-2.5 py-1 text-xs font-semibold"
    >
      <ImageIcon className="h-3.5 w-3.5" /> {isImg ? "ছবি দেখুন" : "ফাইল দেখুন"}
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
