import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
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
  RotateCcw,
  Sparkles,
  Headphones,
  Copy,
  Check,
  ArrowLeft,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { auth, ensureFirebaseAuthUser } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import {
  useCategories,
  useDonationConfig,
  useStaffProfiles,
  useSiteMetaConfig,
  useLogo,
  useAiChatConfig,
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
  handoffAiToLiveChat,
} from "@/lib/cloud";
import { AttachmentView, VoiceRecorderButton, playChatChime } from "@/routes/chat";
import { FormattedChatMessage } from "@/lib/chat-formatter";
import { resolveStaffMessageRole } from "@/lib/chat-roles";
import { useRolePermissions, resolveUserRoleDisplay } from "@/lib/permissions";

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
  "জরুরি অ্যাম্বুলেন্স নাম্বার",
  "রক্তদাতা (O+ / B+) খুঁজুন",
  "হাসপাতাল ও ডাক্তার তালিকা",
  "ফায়ার সার্ভিস ও পুলিশ",
];

export function FloatingLiveChat() {
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

  const [open, setOpen] = useState(false);
  const [chatMode, setChatMode] = useState<"ai" | "live">(() => (aiConfig.enabled ? "ai" : "live"));
  const [threadId, setThreadId] = useState<string | null>(null);
  const [staffSelectedThreadId, setStaffSelectedThreadId] = useState<string | null>(null);
  const [mobileStaffThreadOpen, setMobileStaffThreadOpen] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // AI Conversation State
  const [aiMessages, setAiMessages] = useState<Array<AiChatMessage & { suggestHandoff?: boolean }>>(() => [
    {
      id: "welcome_ai",
      role: "assistant",
      text:
        aiConfig.welcomeMessage ||
        meta.aiWelcomeMessage ||
        "আসসালামু আলাইকুম! আমি স্মার্ট নোয়াখালী এআই সহকারী। ডাক্তার, হাসপাতাল, অ্যাম্বুলেন্স, ফায়ার সার্ভিস, রক্তদাতা বা যেকোনো নাম্বার খুঁজতে আমাকে প্রশ্ন করুন!",
      created_at: new Date().toISOString(),
    },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);

  const threadsHook = useChatThreads();

  // Guest metadata
  const [guestName, setGuestName] = useState(() => localStorage.getItem("sn_guest_name_v1") || "");
  const [guestPhone, setGuestPhone] = useState(() => localStorage.getItem("sn_guest_phone_v1") || "");
  const [showGuestEdit, setShowGuestEdit] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Determine active thread
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
    if (isStaff && open && chatMode === "live" && !staffSelectedThreadId && visibleStaffThreads.length > 0) {
      setStaffSelectedThreadId(visibleStaffThreads[0].id);
    }
  }, [isStaff, open, chatMode, staffSelectedThreadId, visibleStaffThreads]);

  const effectiveThreadId =
    isStaff && staffSelectedThreadId
      ? staffSelectedThreadId
      : isStaff && visibleStaffThreads.length > 0
        ? visibleStaffThreads[0].id
        : user?.id || activeUid || getOrCreateGuestId();

  function resetAiChat() {
    setAiMessages([
      {
        id: "welcome_ai",
        role: "assistant",
        text:
          aiConfig.welcomeMessage ||
          meta.aiWelcomeMessage ||
          "আসসালামু আলাইকুম! আমি স্মার্ট নোয়াখালী এআই সহকারী। ডাক্তার, হাসপাতাল, অ্যাম্বুলেন্স, রক্তদাতা বা যেকোনো জরুরি সেবা সম্পর্কে আমাকে প্রশ্ন করুন!",
        created_at: new Date().toISOString(),
      },
    ]);
    toast.success("নতুন এআই চ্যাট শুরু হয়েছে!");
  }

  async function handleHandoffToLiveChat() {
    if (!effectiveThreadId || handoffBusy) return;
    setHandoffBusy(true);
    try {
      const recentQueries = aiMessages
        .filter((m) => m.id !== "welcome_ai")
        .slice(-4)
        .map((m) => `${m.role === "user" ? "গ্রাহক" : "AI"}: ${m.text.slice(0, 140)}`)
        .join("\n");
      const summary = recentQueries || "গ্রাহক সরাসরি হিউম্যান সাপোর্টের সাথে কথা বলতে চান।";
      const res = await handoffAiToLiveChat({
        threadId: effectiveThreadId,
        userId: user?.id || effectiveThreadId,
        summary,
        userName: user?.displayName || guestName || "অতিথি গ্রাহক",
        userEmail: user?.email || undefined,
        userPhone: user?.phone || guestPhone || undefined,
      });
      if (!res.ok) {
        toast.error(res.error || "হ্যান্ডঅফ করতে সমস্যা হয়েছে");
        return;
      }
      setChatMode("live");
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

  const {
    items,
    loading: msgsLoading,
    error: msgsError,
    send,
    retrySend,
    refresh: refreshMsgs,
  } = useThreadMessages(open && chatMode === "live" ? threadId : null);

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (open && chatMode === "live" && threadId) {
      void markThreadRead(threadId, isStaff ? "staff" : "user");
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

  const prevUnreadRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = unreadCount;
      return;
    }
    if (unreadCount > prevUnreadRef.current && isStaff && !open) {
      playChatChime("receive");
      toast.info(`লাইভ চ্যাটে নতুন বার্তা এসেছে (${unreadCount}টি অপঠিত)`, {
        id: "sn-live-chat-incoming",
      });
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, isStaff, open]);

  function handleCopy(textToCopy: string, id: string) {
    void navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    toast.success("বার্তা কপি করা হয়েছে!");
    setTimeout(() => setCopiedId(null), 2000);
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
    playChatChime("send");
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

      const data = await resp.json().catch(() => ({}));
      const baseText =
        data.fallbackText ||
        data.text ||
        data.reply ||
        `স্মার্ট নোয়াখালী এআই সহকারী: আপনার অনুসন্ধানের জন্য সরাসরি যোগাযোগ:\n• জাতীয় জরুরি সেবা: 📞 [৯৯৯](tel:999)\n• নোয়াখালী জেনারেল হাসপাতাল: 📞 [01730-324794](tel:01730324794)\n• নোয়াখালী ফায়ার সার্ভিস: 📞 [01730-002444](tel:01730002444)\n• সুধারাম মডেল থানা: 📞 [01320-116035](tel:01320116035)\n\nঅথবা নিচের 'হিউম্যান সাপোর্ট' বাটনে ট্যাপ করে সরাসরি অপারেটরদের সাথে কথা বলুন।`;

      const statusBanner = !resp.ok
        ? resp.status === 429
          ? "⚠️ **এআই সার্ভারে অতিরিক্ত চাপ (Rate Limit)** — তাৎক্ষণিক ডিরেক্টরি তথ্য দেখানো হচ্ছে:\n\n"
          : "ℹ️ **তাৎক্ষণিক ডিরেক্টরি অনুসন্ধান মোড** (এআই মডেল সংযোগ অনুপলব্ধ):\n\n"
        : "";

      const replyMsg: AiChatMessage & { suggestHandoff?: boolean } = {
        id: `a_${Date.now()}`,
        role: "assistant",
        text: `${statusBanner}${baseText}`,
        created_at: new Date().toISOString(),
        matches: data.matches,
        suggestHandoff: Boolean(!resp.ok || data.suggestHandoff || aiConfig.autoSuggestHandoff),
      };
      setAiMessages((prev) => [...prev, replyMsg]);
      playChatChime("receive");
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `fallback_${Date.now()}`,
          role: "assistant",
          text: `স্মার্ট নোয়াখালী এআই সহকারী: তাৎক্ষণিক যোগাযোগের জন্য জরুরি সেবা:\n• জরুরি হটলাইন: 📞 [৯৯৯](tel:999)\n• নোয়াখালী সদর হাসপাতাল: 📞 [01730-324794](tel:01730324794)\n• ফায়ার সার্ভিস: 📞 [01730-002444](tel:01730002444)\n\nসরাসরি সাপোর্ট টিমের সাথে কথা বলতে নিচের 'হিউম্যান সাপোর্টে যুক্ত হোন' বাটনে চাপ দিন।`,
          created_at: new Date().toISOString(),
          suggestHandoff: true,
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }

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
    : user?.displayName || guestName || "অতিথি গ্রাহক";

  const activeThreadRow = threadsHook.items.find((t) => t.id === threadId);

  const myStaffProfile = isStaff ? getStaffProfile(user?.id) || getStaffProfile(user?.email) : null;

  const userMeta = {
    user_name: effectiveSenderName,
    user_email: isStaff && isMainAdmin ? undefined : user?.email || undefined,
    user_phone: isStaff && isMainAdmin ? undefined : user?.phone || guestPhone || undefined,
    sender_name: effectiveSenderName,
    sender_photo: isStaff ? myStaffProfile?.photo_url || logo : undefined,
    sender_role_label: senderRoleLabel,
  };

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !threadId) return;
    setText("");
    const role = isStaff ? "staff" : "user";
    const senderId = user?.id || threadId;
    playChatChime("send");
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
      playChatChime("send");
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
      const file = new File([blob], `voice-${Date.now()}.webm`, {
        type: "audio/webm",
      });
      const url = await uploadPublicImage(file, `chat/${threadId}`);
      if (!url) return toast.error("ভয়েস মেসেজ আপলোড করা যায়নি");
      const role = isStaff ? "staff" : "user";
      const senderId = user?.id || threadId;
      playChatChime("send");
      const { error } = await send(senderId, role, "", url, userMeta);
      if (error) toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (pathname.startsWith("/mdmahmudulhashan") || pathname.startsWith("/chat")) {
    return null;
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-1.5 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="লাইভ চ্যাট ও এআই সহকারী"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[82dvh] max-h-[calc(100dvh-1rem)] min-h-[380px] w-full flex-col overflow-hidden rounded-[12px] border border-[#E6E1D6] bg-white md:h-[84vh] md:max-h-[860px] md:w-[88vw] lg:w-[86vw] xl:w-[84vw] max-w-[1380px]"
          >
            {/* Compact Header (Calm Civic Theme) */}
            <div className="shrink-0 bg-[#0F4D3A] px-3.5 py-2.5 text-white sm:px-5 sm:py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                    {chatMode === "ai" ? (
                      <Bot className="h-5 w-5 text-white" strokeWidth={1.5} />
                    ) : (
                      <Headphones className="h-5 w-5 text-white" strokeWidth={1.5} />
                    )}
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0F4D3A]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold leading-tight sm:text-base">
                      {chatMode === "ai" ? aiConfig.botName || "স্মার্ট নোয়াখালী AI" : "সরাসরি লাইভ সাপোর্ট"}
                    </p>
                    <p className="truncate text-[11px] text-white/85">
                      {chatMode === "ai"
                        ? "এআই সহকারী • তাৎক্ষণিক তথ্য সহায়তা"
                        : isStaff
                          ? `${senderRoleLabel} • অপারেটর ইনবক্স`
                          : "হিউম্যান অপারেটর • সরাসরি বার্তা"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Compact Inline Mode Switcher */}
                  <div className="flex items-center gap-1 rounded-[10px] bg-black/20 p-0.5">
                    <button
                      type="button"
                      onClick={() => setChatMode("ai")}
                      className={`flex items-center gap-1 rounded-[8px] px-2.5 py-1 text-[11px] font-bold transition ${
                        chatMode === "ai"
                          ? "bg-white text-[#0F4D3A]"
                          : "text-white/85 hover:text-white"
                      }`}
                    >
                      <Sparkles className="h-3 w-3" strokeWidth={1.5} /> এআই
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatMode("live")}
                      className={`relative flex items-center gap-1 rounded-[8px] px-2.5 py-1 text-[11px] font-bold transition ${
                        chatMode === "live"
                          ? "bg-white text-[#0F4D3A]"
                          : "text-white/85 hover:text-white"
                      }`}
                    >
                      <MessageCircle className="h-3 w-3" strokeWidth={1.5} /> লাইভ
                      {unreadCount > 0 && (
                        <span className="ml-0.5 rounded-full bg-[#C62828] px-1.5 py-0.2 text-[9px] font-extrabold text-white">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  </div>

                  <Link
                    to={isStaff && chatMode === "live" ? "/mdmahmudulhashan" : "/chat"}
                    onClick={() => setOpen(false)}
                    title="পূর্ণ পৃষ্ঠায় খুলুন"
                    className="rounded-full p-1.5 text-white/85 transition hover:bg-white/15 hover:text-white"
                  >
                    <Maximize2 className="h-4 w-4" strokeWidth={1.5} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    title="বন্ধ করুন"
                    className="rounded-full p-1.5 text-white/85 transition hover:bg-white/15 hover:text-white"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>

            {/* Body: AI Mode */}
            {chatMode === "ai" ? (
              <div className="flex flex-1 min-h-0 flex-col">
                <div className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-[#FAF7F2] p-3.5 sm:p-5">
                {!aiConfig.enabled && (
                  <div className="rounded-[12px] border border-[#E6E1D6] bg-white p-3 text-center text-xs text-[#1C1C1C] space-y-2">
                    <p className="font-bold">এআই চ্যাট সাময়িকভাবে বন্ধ রয়েছে</p>
                    <button
                      type="button"
                      onClick={() => setChatMode("live")}
                      className="rounded-[10px] bg-[#0F4D3A] px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      সরাসরি লাইভ সাপোর্টে যান
                    </button>
                  </div>
                )}
                {/* Quick AI Search Prompts with Reset Button */}
                <div className="flex items-center justify-between gap-1 pb-1">
                  <span className="text-[11px] font-bold text-[#0F4D3A] flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} /> দ্রুত সেবা প্রশ্ন
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={handoffBusy}
                      onClick={() => void handleHandoffToLiveChat()}
                      className="flex items-center gap-1 rounded-[10px] border border-[#0F4D3A] bg-white px-2.5 py-1 text-[11px] font-bold text-[#0F4D3A] hover:bg-[#0F4D3A] hover:text-white transition"
                      title="সরাসরি অপারেটরের সাথে যুক্ত হোন"
                    >
                      <Headphones className="h-3 w-3" strokeWidth={1.5} /> হিউম্যান সাপোর্ট
                    </button>
                    <button
                      type="button"
                      onClick={resetAiChat}
                      className="flex items-center gap-1 rounded-[8px] border border-[#E6E1D6] bg-white px-2 py-1 text-[11px] font-semibold text-[#5F5F5A] hover:text-[#0F4D3A] transition"
                      title="নতুন এআই চ্যাট শুরু করুন"
                    >
                      <RotateCcw className="h-3 w-3" strokeWidth={1.5} /> রিসেট
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(aiConfig.quickPrompts.length > 0 ? aiConfig.quickPrompts : QUICK_AI_PROMPTS).map((qp) => (
                    <button
                      key={qp}
                      type="button"
                      onClick={() => void askAi(qp)}
                      className="rounded-[10px] border border-[#E6E1D6] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#1C1C1C] transition hover:border-[#0F4D3A] hover:text-[#0F4D3A]"
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
                        className={`group max-w-[88%] rounded-[12px] px-3.5 py-2.5 text-sm ${
                          isUser
                            ? "bg-[#0F4D3A] text-white"
                            : "border border-[#E6E1D6] bg-white text-[#1C1C1C]"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {!isUser && <Bot className="h-3.5 w-3.5 text-[#0F4D3A]" strokeWidth={1.5} />}
                            <span
                              className={`text-[11px] font-bold ${
                                isUser ? "text-white/90" : "text-[#0F4D3A]"
                              }`}
                            >
                              {isUser ? "আপনি" : `${aiConfig.botName || "স্মার্ট এআই"} (AI সহকারী)`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(m.text, m.id)}
                            className="rounded p-0.5 opacity-60 hover:opacity-100"
                            title="কপি করুন"
                          >
                            {copiedId === m.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        <FormattedChatMessage text={m.text} isUser={isUser} />

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
                                    className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground"
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
                                  className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white"
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

                        {/* AI -> Human Live Chat Handoff CTA */}
                        {!isUser && m.suggestHandoff && (
                          <div className="mt-2 border-t border-indigo-100 pt-2">
                            <p className="text-[10px] text-muted-foreground mb-1">
                              {aiConfig.handoffNotice}
                            </p>
                            <button
                              type="button"
                              disabled={handoffBusy}
                              onClick={() => void handleHandoffToLiveChat()}
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
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
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-card px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
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
                  className="shrink-0 flex items-end gap-2 border-t border-border bg-card px-3 py-2.5 sm:px-4"
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
                    placeholder="যেকোনো তথ্য বা নাম্বার খুঁজুন..."
                    className="min-h-[40px] max-h-28 min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl border border-border bg-background px-3.5 py-2 text-sm leading-relaxed outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading}
                    className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-full bg-gradient-hero px-3.5 text-xs font-bold text-primary-foreground shadow-card active:scale-95 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">পাঠান</span>
                  </button>
                </form>
              </div>
            ) : (
              <div
                className={`flex-1 min-h-0 ${
                  isStaff
                    ? "grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]"
                    : "flex flex-col"
                }`}
              >
                {/* Staff Left Conversation List */}
                {isStaff && (
                  <aside
                    className={`${
                      mobileStaffThreadOpen ? "hidden lg:flex" : "flex"
                    } min-h-0 flex-col border-border/80 bg-muted/15 lg:border-r`}
                  >
                    <div className="shrink-0 space-y-2 border-b border-border/70 p-2.5 sm:p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-display text-xs font-bold text-primary-deep">
                          কথোপকথন ({visibleStaffThreads.length})
                        </p>
                        <Link
                          to="/mdmahmudulhashan"
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20"
                        >
                          <ShieldCheck className="h-3 w-3" /> ড্যাশবোর্ড
                        </Link>
                      </div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          placeholder="নাম বা বার্তা খুঁজুন..."
                          className="w-full rounded-xl border border-border bg-card py-1.5 pl-8 pr-2.5 text-xs outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto p-2">
                      {visibleStaffThreads.length === 0 ? (
                        <p className="py-10 text-center text-xs text-muted-foreground">
                          কোনো অনুমোদিত চ্যাট নেই
                        </p>
                      ) : (
                        visibleStaffThreads.map((t) => {
                          const isSelected = threadId === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setStaffSelectedThreadId(t.id);
                                setMobileStaffThreadOpen(true);
                              }}
                              className={`flex w-full items-start justify-between gap-2 rounded-xl border p-2.5 text-left transition ${
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

                {/* Active Conversation View */}
                <div
                  className={`${
                    isStaff && !mobileStaffThreadOpen ? "hidden lg:flex" : "flex"
                  } min-h-0 flex-1 flex-col`}
                >
                  {/* Header notice for guest or staff */}
                  {!isAuthed && (
                    <div className="shrink-0 flex flex-col border-b border-border bg-amber-500/10 px-3 py-1.5 text-xs text-amber-950">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate text-[11px]">
                          অতিথি চ্যাট: <strong>{guestName || "গ্রাহক"}</strong>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowGuestEdit(!showGuestEdit)}
                            className="text-[10px] font-bold text-amber-900 underline"
                          >
                            {showGuestEdit ? "সম্পন্ন" : "নাম লিখুন"}
                          </button>
                          <a
                            href="/auth"
                            className="rounded bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground"
                          >
                            লগইন করুন
                          </a>
                        </div>
                      </div>
                      {showGuestEdit && (
                        <div className="mt-1.5 flex gap-1.5">
                          <input
                            value={guestName}
                            onChange={(e) => {
                              setGuestName(e.target.value);
                              localStorage.setItem("sn_guest_name_v1", e.target.value);
                            }}
                            placeholder="আপনার নাম..."
                            className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-[10px]"
                          />
                          <input
                            value={guestPhone}
                            onChange={(e) => {
                              setGuestPhone(e.target.value);
                              localStorage.setItem("sn_guest_phone_v1", e.target.value);
                            }}
                            placeholder="মোবাইল নম্বর..."
                            className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-[10px]"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {isStaff && (
                    <div className="shrink-0 flex items-center justify-between gap-2 bg-primary/10 px-3 py-1.5 text-[11px] text-primary-deep border-b border-border">
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMobileStaffThreadOpen(false)}
                          className="inline-flex items-center gap-1 rounded-lg bg-card px-2 py-0.5 text-[11px] font-bold text-foreground shadow-2xs ring-1 ring-border lg:hidden"
                        >
                          <ArrowLeft className="h-3 w-3" /> তালিকা
                        </button>
                        <span className="truncate font-bold">
                          {activeThreadRow?.user_name || activeThreadRow?.user_email || `${senderRoleLabel} হিসেবে চ্যাট করছেন`}
                        </span>
                      </div>
                      <Link
                        to="/mdmahmudulhashan"
                        onClick={() => setOpen(false)}
                        className="shrink-0 text-[10.5px] font-bold text-primary underline"
                      >
                        পূর্ণ ইনবক্স ({unreadCount}) →
                      </Link>
                    </div>
                  )}

                  {activeThreadRow && (activeThreadRow.status === "resolved" || activeThreadRow.status === "closed") && (
                    <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-3 py-1 text-[10.5px] font-semibold text-amber-900">
                      এই কথোপকথনটি {activeThreadRow.status === "resolved" ? "সমাধানকৃত" : "বন্ধ"} হিসেবে চিহ্নিত — নতুন বার্তা পাঠালে স্বয়ংক্রিয়ভাবে পুনরায় চালু হবে।
                    </div>
                  )}

                  <div className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-background/60 p-3.5 sm:p-5">
                    {msgsError && (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-800">
                        <span>{msgsError}</span>
                        <button
                          type="button"
                          onClick={() => refreshMsgs()}
                          className="rounded-lg bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white"
                        >
                          পুনরায় লোড
                        </button>
                      </div>
                    )}
                    {msgsLoading && items.length === 0 && (
                      <div className="py-10 text-center text-xs text-muted-foreground">
                        <Loader2 className="mx-auto mb-1.5 h-5 w-5 animate-spin text-primary" />
                        বার্তা লোড হচ্ছে...
                      </div>
                    )}
                    {!msgsLoading && items.length === 0 && (
                      <div className="rounded-[12px] border border-dashed border-[#E6E1D6] bg-white p-5 text-center text-xs text-[#5F5F5A]">
                        আপনার যেকোনো প্রশ্ন বা জরুরি তথ্যের জন্য বার্তা লিখুন — এডমিন/মডারেটর উত্তর দিলে তার নাম ও পদবি এখানে দেখতে পাবেন।
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
                          className={`flex items-end gap-2 ${
                            mine ? "justify-end" : "justify-start"
                          }`}
                        >
                          {!mine && (
                            <img
                              src={staffPhoto}
                              alt={staffName}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = logo;
                              }}
                              className="h-8 w-8 shrink-0 rounded-full border border-[#E6E1D6] bg-white object-cover"
                            />
                          )}
                          <div
                            className={`max-w-[85%] sm:max-w-[76%] rounded-[12px] px-3.5 py-2.5 text-[14px] ${
                              mine
                                ? "bg-[#0F4D3A] text-white"
                                : "border border-[#E6E1D6] bg-white text-[#1C1C1C]"
                            }`}
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`text-[11px] font-bold ${
                                  mine ? "text-white/90" : "text-[#0F4D3A]"
                                }`}
                              >
                                {mine
                                  ? "আপনি"
                                  : isStaff
                                    ? `${staffName}`
                                    : `Human Admin (${staffName} • ${staffRole})`}
                              </span>
                            </div>
                            {m.body && (
                              <p className="whitespace-pre-wrap break-words leading-relaxed">
                                {m.body}
                              </p>
                            )}
                            {m.attachment_url && (
                              <AttachmentView url={m.attachment_url} />
                            )}
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
                                      className="inline-flex items-center gap-1 rounded bg-rose-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white hover:bg-rose-700"
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
                          {mine && (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                              <UserIcon className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={endRef} />
                  </div>

                  {canReplyChat ? (
                    <form
                      onSubmit={onSend}
                      className="shrink-0 flex items-end gap-1.5 sm:gap-2 border-t border-border bg-card px-2.5 py-2 sm:px-4 sm:py-2.5"
                    >
                      <label
                        title="ছবি বা ফাইল যুক্ত করুন"
                        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-primary transition hover:bg-muted"
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
                      <textarea
                        rows={1}
                        value={text}
                        onChange={(e) => {
                          setText(e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void onSend(e as unknown as React.FormEvent);
                          }
                        }}
                        onFocus={() => setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 120)}
                        placeholder="বার্তা লিখুন..."
                        maxLength={2000}
                        className="min-h-[40px] max-h-28 min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl border border-border bg-background px-3.5 py-2 text-sm leading-relaxed outline-none focus:border-primary"
                      />
                      <button
                        type="submit"
                        disabled={busy || !text.trim()}
                        className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-[10px] bg-[#0F4D3A] px-3.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" strokeWidth={1.5} />
                        <span className="hidden sm:inline">পাঠান</span>
                      </button>
                    </form>
                  ) : (
                    <div className="shrink-0 border-t border-[#E6E1D6] bg-[#FAF7F2] px-4 py-2 text-center text-xs font-semibold text-[#5F5F5A]">
                      আপনার ভূমিকায় উত্তর দেওয়ার পারমিশন (chat_reply) নেই।
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Action Button (Bottom-Right, docked cleanly above mobile BottomNav) */}
      <div className="fixed bottom-[76px] right-4 z-40 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="লাইভ চ্যাট ও AI সহায়তা"
          title="লাইভ চ্যাট ও AI"
          className="relative flex h-12 min-w-[48px] items-center justify-center gap-2 rounded-full border border-[#E6E1D6] bg-[#0F4D3A] px-3.5 text-white transition-transform duration-150 hover:bg-[#0c3f30] active:scale-95"
        >
          {open ? (
            <X className="h-5 w-5" strokeWidth={1.5} />
          ) : (
            <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
          )}
          <span className="hidden sm:inline font-display text-xs font-semibold">
            লাইভ চ্যাট ও AI
          </span>
          {unreadCount > 0 && !open && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C62828] px-1 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
