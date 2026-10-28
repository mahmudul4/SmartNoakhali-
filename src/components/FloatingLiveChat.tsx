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
  RotateCcw,
  Sparkles,
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
import { AttachmentView, VoiceRecorderButton, playChatChime } from "@/routes/chat";
import { FormattedChatMessage } from "@/lib/chat-formatter";
import { resolveStaffMessageRole } from "@/lib/chat-roles";

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
  const { user, isAuthed, isStaff, isMainAdmin, isAdmin, isEditor, isModerator } = useAuth();
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

  const effectiveThreadId = user?.id || activeUid || getOrCreateGuestId();

  function resetAiChat() {
    setAiMessages([
      {
        id: "welcome_ai",
        role: "assistant",
        text:
          meta.aiWelcomeMessage ||
          "আসসালামু আলাইকুম! আমি স্মার্ট নোয়াখালী এআই সহকারী। ডাক্তার, হাসপাতাল, অ্যাম্বুলেন্স, রক্তদাতা বা যেকোনো প্রশ্ন, অনুবাদ ও কোডিং সহায়তায় আমাকে লিখুন!",
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

  const { items, send } = useThreadMessages(
    open && chatMode === "live" ? threadId : null
  );

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
      const replyText =
        data.text ||
        data.reply ||
        `স্মার্ট নোয়াখালী এআই সহকারী: আপনার অনুসন্ধানের জন্য সরাসরি যোগাযোগ:\n• জাতীয় জরুরি সেবা: 📞 [999](tel:999)\n• নোয়াখালী জেনারেল হাসপাতাল: 📞 [01730-324794](tel:01730324794)\n• নোয়াখালী ফায়ার সার্ভিস: 📞 [01730-002444](tel:01730002444)\n• সুধারাম মডেল থানা: 📞 [01320-116035](tel:01320116035)\n\nঅথবা উপরের 'লাইভ চ্যাট' ট্যাবে মেসেজ দিয়ে সরাসরি এডমিনদের সাথে কথা বলুন।`;

      const replyMsg: AiChatMessage = {
        id: `a_${Date.now()}`,
        role: "assistant",
        text: replyText,
        created_at: new Date().toISOString(),
        matches: data.matches,
      };
      setAiMessages((prev) => [...prev, replyMsg]);
      playChatChime("receive");
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `fallback_${Date.now()}`,
          role: "assistant",
          text: `স্মার্ট নোয়াখালী এআই সহকারী: তাৎক্ষণিক যোগাযোগের জন্য জরুরি সেবা:\n• জরুরি হটলাইন: 📞 [999](tel:999)\n• নোয়াখালী সদর হাসপাতাল: 📞 [01730-324794](tel:01730324794)\n• ফায়ার সার্ভিস: 📞 [01730-002444](tel:01730002444)\n\nসরাসরি এডমিনের সাথে কথা বলতে 'লাইভ চ্যাট' ট্যাবে মেসেজ দিন।`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }

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
    : user?.displayName || guestName || "অতিথি গ্রাহক";

  const userMeta = {
    user_name: effectiveSenderName,
    user_email: isStaff && isMainAdmin ? undefined : user?.email || undefined,
    user_phone: isStaff && isMainAdmin ? undefined : user?.phone || guestPhone || undefined,
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
    playChatChime("send");
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
    playChatChime("send");
    const { error } = await send(senderId, role, "", url, userMeta);
    if (error) toast.error(error.message);
  }

  async function onVoice(blob: Blob) {
    if (!threadId) return;
    setBusy(true);
    const file = new File([blob], `voice-${Date.now()}.webm`, {
      type: "audio/webm",
    });
    const url = await uploadPublicImage(file, `chat/${threadId}`);
    setBusy(false);
    if (!url) return toast.error("আপলোড ব্যর্থ");
    const role = isStaff ? "staff" : "user";
    const senderId = user?.id || threadId;
    playChatChime("send");
    const { error } = await send(senderId, role, "", url, userMeta);
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
                {/* Quick AI Search Prompts with Reset Button */}
                <div className="flex items-center justify-between gap-1 pb-1">
                  <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-gold" /> দ্রুত সেবা প্রশ্ন
                  </span>
                  <button
                    type="button"
                    onClick={resetAiChat}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-primary transition"
                    title="নতুন এআই চ্যাট শুরু করুন"
                  >
                    <RotateCcw className="h-3 w-3" /> নতুন চ্যাট
                  </button>
                </div>
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
          ) : (
            <>
              {/* Header notice for guest or staff */}
              {!isAuthed && (
                <div className="flex flex-col border-b border-border bg-amber-500/10 px-3 py-1.5 text-xs text-amber-950">
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
                <div className="flex items-center justify-between bg-primary/10 px-3 py-1 text-[11px] text-primary-deep border-b border-border">
                  <span className="font-semibold">এডমিন/স্টাফ হিসেবে চ্যাট করছেন</span>
                  <Link
                    to="/mdmahmudulhashan"
                    onClick={() => setOpen(false)}
                    className="text-[10px] font-bold text-primary underline"
                  >
                    ইনবক্স ({unreadCount}) →
                  </Link>
                </div>
              )}
              <div className="flex-1 space-y-2.5 overflow-y-auto bg-background/60 p-3">
                {items.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-card/80 p-5 text-center text-xs text-muted-foreground">
                    আপনার যেকোনো প্রশ্ন বা জরুরী তথ্যের জন্য বার্তা লিখুন — এডমিন/মডারেটর উত্তর দিলে তার নাম ও ছবি এখানে দেখতে পাবেন।
                  </div>
                )}
                {items.map((m) => {
                  const mine = m.sender_role === "user";
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
