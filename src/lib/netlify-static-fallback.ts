// ============================================================================
// Safe Static Hosting Fallback for Netlify Drag-and-Drop / ZIP Deploys
// Intercepts /api/* ONLY when the static host returns 404 or HTML,
// and uses Object.defineProperty wrapped in try/catch so it never throws.
// ============================================================================

const LS_USERS = "sn_static_verified_users_v1";
const LS_DELETED_USERS = "sn_static_deleted_users_v1";
const LS_CHAT = "sn_static_chat_store_v1";
const LS_AUDIT = "sn_staff_activity_audit_v1";
const LS_CONTENT = "sn_static_content_store_v1";
const LS_OTP = "sn_static_otp_sessions_v1";

function readLs<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return fallback;
}

function writeLs(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

function jsonResp(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function toEnglishDigits(str = ""): string {
  const map: Record<string, string> = {
    "০": "0",
    "১": "1",
    "২": "2",
    "৩": "3",
    "৪": "4",
    "৫": "5",
    "৬": "6",
    "৭": "7",
    "৮": "8",
    "৯": "9",
  };
  return String(str).replace(/[০-৯]/g, (d) => map[d] ?? d);
}

function normalizePhone(raw = ""): string {
  const digits = toEnglishDigits(raw).replace(/\D/g, "");
  if (digits.startsWith("8801") && digits.length === 13) return digits.slice(2);
  if (digits.startsWith("01") && digits.length === 11) return digits;
  if (digits.startsWith("1") && digits.length === 10) return `0${digits}`;
  return digits;
}

async function handleStaticApiFallback(
  apiPath: string,
  method: string,
  body: Record<string, any>
): Promise<Response> {
  // 1. OTP Send
  if (method === "POST" && apiPath === "/api/auth/send-otp") {
    const mode = body.channel === "phone" ? "phone" : "email";
    const cleanEmail = String(body.email || "").trim().toLowerCase();
    const cleanPhone = normalizePhone(String(body.phone || ""));
    const targetKey = mode === "email" ? `email:${cleanEmail}` : `phone:${cleanPhone}`;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const otpToken = `${expiresAt}.${btoa(`${targetKey}:${code}`)}`;

    const sessions = readLs<Record<string, any>>(LS_OTP, {});
    sessions[targetKey] = { code, expiresAt, verified: false };
    writeLs(LS_OTP, sessions);

    return jsonResp(200, {
      ok: true,
      channel: mode,
      target: mode === "email" ? cleanEmail : cleanPhone,
      delivered: false,
      otpToken,
      fallbackCode: code,
      message: `আপনার ৬ সংখ্যার ভেরিফিকেশন কোড: ${code}`,
    });
  }

  // 2. OTP Verify
  if (method === "POST" && apiPath === "/api/auth/verify-otp") {
    const mode = body.channel === "phone" ? "phone" : "email";
    const cleanEmail = String(body.email || "").trim().toLowerCase();
    const cleanPhone = normalizePhone(String(body.phone || ""));
    const cleanCode = toEnglishDigits(String(body.code || "")).replace(/\D/g, "");
    const targetKey = mode === "email" ? `email:${cleanEmail}` : `phone:${cleanPhone}`;
    const sessions = readLs<Record<string, any>>(LS_OTP, {});
    const sess = sessions[targetKey];

    let valid = Boolean(sess && sess.code === cleanCode && Date.now() <= sess.expiresAt);
    if (!valid && body.otpToken) {
      const [expStr, b64] = String(body.otpToken).split(".");
      if (Number(expStr) > Date.now() && b64 === btoa(`${targetKey}:${cleanCode}`)) {
        valid = true;
      }
    }
    if (!valid) {
      return jsonResp(400, { error: "ভুল ভেরিফিকেশন কোড। অনুগ্রহ করে সঠিক ৬ সংখ্যার কোড দিন।" });
    }
    return jsonResp(200, {
      ok: true,
      verified: true,
      channel: mode,
      target: mode === "email" ? cleanEmail : cleanPhone,
    });
  }

  // 3. User Sync & Lookup
  if (method === "POST" && apiPath === "/api/auth/sync-user") {
    const cleanEmail = String(body.email || "").trim().toLowerCase();
    const cleanPhone = normalizePhone(String(body.phone || ""));
    const uid = String(body.uid || cleanEmail || cleanPhone || `u_${Date.now()}`).trim();
    const store = readLs<Record<string, any>>(LS_USERS, {});
    const existing = store[uid] || {};
    const now = new Date().toISOString();
    const record = {
      uid,
      email: cleanEmail || existing.email || "",
      phone: cleanPhone || existing.phone || "",
      password: body.password !== undefined ? body.password : existing.password,
      full_name: body.full_name || existing.full_name || "ইউজার",
      username: body.username || existing.username || "user",
      verified_via: body.verified_via || existing.verified_via || "email",
      is_verified: true,
      roles: Array.isArray(body.roles) ? body.roles : existing.roles || ["user"],
      photo_url: body.photo_url !== undefined ? body.photo_url : existing.photo_url,
      designation: body.designation !== undefined ? body.designation : existing.designation,
      suspended: body.suspended ?? existing.suspended ?? false,
      created_at: existing.created_at || now,
      updated_at: now,
    };
    store[uid] = record;
    writeLs(LS_USERS, store);
    return jsonResp(200, { ok: true, user: record });
  }

  if (method === "GET" && apiPath === "/api/auth/users") {
    const store = readLs<Record<string, any>>(LS_USERS, {});
    const deletedIds = readLs<string[]>(LS_DELETED_USERS, []);
    const delSet = new Set(deletedIds.map((x) => x.toLowerCase()));
    const users = Object.values(store).filter(
      (u: any) =>
        !delSet.has(String(u.uid || "").toLowerCase()) &&
        (!u.email || !delSet.has(String(u.email).toLowerCase()))
    );
    return jsonResp(200, { ok: true, users, deletedIds });
  }

  if (method === "POST" && apiPath === "/api/auth/delete-user") {
    const uid = String(body.user_id || "").trim();
    const cleanEmail = String(body.email || "").trim().toLowerCase();
    const store = readLs<Record<string, any>>(LS_USERS, {});
    const deletedIds = readLs<string[]>(LS_DELETED_USERS, []);
    if (uid) {
      delete store[uid];
      deletedIds.push(uid);
    }
    if (cleanEmail) {
      deletedIds.push(cleanEmail);
      for (const [k, v] of Object.entries(store)) {
        if (String(v?.email || "").toLowerCase() === cleanEmail) delete store[k];
      }
    }
    writeLs(LS_USERS, store);
    writeLs(LS_DELETED_USERS, Array.from(new Set(deletedIds)));
    return jsonResp(200, { ok: true });
  }

  if (method === "POST" && apiPath === "/api/auth/login-lookup") {
    const rawId = String(body.identifier || "").trim();
    const cleanEmail = rawId.toLowerCase();
    const cleanPhone = normalizePhone(rawId);
    const store = readLs<Record<string, any>>(LS_USERS, {});
    const matched = Object.values(store).find(
      (u: any) =>
        (cleanEmail && String(u.email || "").toLowerCase() === cleanEmail) ||
        (cleanPhone && cleanPhone.length >= 10 && normalizePhone(u.phone) === cleanPhone) ||
        (cleanEmail && String(u.username || "").toLowerCase() === cleanEmail)
    );
    if (!matched) return jsonResp(200, { ok: true, found: false });
    return jsonResp(200, {
      ok: true,
      found: true,
      passwordMatches: Boolean(body.password && matched.password === body.password),
      user: matched,
    });
  }

  // 4. Content & Cloud Mirror Store
  if (method === "GET" && apiPath === "/api/content") {
    return jsonResp(200, readLs<Record<string, any>>(LS_CONTENT, {}));
  }
  if (method === "POST" && apiPath === "/api/content/sync") {
    const cur = readLs<Record<string, any>>(LS_CONTENT, {});
    const next = { ...cur, ...body, updatedAt: new Date().toISOString() };
    writeLs(LS_CONTENT, next);
    return jsonResp(200, { ok: true, store: next });
  }

  // 5. Audit Logs
  if (method === "GET" && apiPath === "/api/audit/logs") {
    return jsonResp(200, { ok: true, logs: readLs<any[]>(LS_AUDIT, []) });
  }
  if (method === "POST" && apiPath === "/api/audit/record") {
    const cur = readLs<any[]>(LS_AUDIT, []);
    if (body.entry?.id) {
      const next = [body.entry, ...cur.filter((x) => x.id !== body.entry.id)].slice(0, 300);
      writeLs(LS_AUDIT, next);
    }
    return jsonResp(200, { ok: true });
  }
  if (method === "POST" && apiPath === "/api/audit/mark-restored") {
    const cur = readLs<any[]>(LS_AUDIT, []).map((x) =>
      x.id === body.id ? { ...x, restored: true } : x
    );
    writeLs(LS_AUDIT, cur);
    return jsonResp(200, { ok: true });
  }
  if (method === "POST" && apiPath === "/api/audit/clear") {
    writeLs(LS_AUDIT, []);
    return jsonResp(200, { ok: true });
  }

  // 6. Live Chat Store
  const defaultChat = {
    threads: {} as Record<string, any>,
    messages: {} as Record<string, any[]>,
    deletedThreads: {} as Record<string, string>,
    deletedAllBefore: null as string | null,
    deletedMessages: [] as string[],
  };
  if (method === "GET" && apiPath === "/api/chat/threads") {
    const chat = readLs(LS_CHAT, defaultChat);
    return jsonResp(200, {
      ok: true,
      threads: Object.values(chat.threads),
      messagesByThread: chat.messages,
      deletedThreads: chat.deletedThreads,
      deletedAllBefore: chat.deletedAllBefore,
      deletedMessages: chat.deletedMessages,
    });
  }
  if (method === "GET" && apiPath.startsWith("/api/chat/messages/")) {
    const threadId = decodeURIComponent(apiPath.replace("/api/chat/messages/", ""));
    const chat = readLs(LS_CHAT, defaultChat);
    return jsonResp(200, {
      ok: true,
      thread: chat.threads[threadId] || null,
      messages: chat.messages[threadId] || [],
      deletedAt: chat.deletedThreads[threadId] || null,
      deletedAllBefore: chat.deletedAllBefore,
      deletedMessages: chat.deletedMessages,
    });
  }
  if (method === "POST" && apiPath === "/api/chat/send") {
    const chat = readLs(LS_CHAT, defaultChat);
    const tid = String(body.thread_id || body.user_id || "").trim();
    const now = new Date().toISOString();
    const msg = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      thread_id: tid,
      sender_id: String(body.sender_id || tid),
      sender_role: body.sender_role === "staff" ? "staff" : "user",
      sender_name: body.sender_name || "গ্রাহক",
      sender_photo: body.sender_photo || "",
      sender_role_label: body.sender_role_label || "",
      body: body.body || "",
      attachment_url: body.attachment_url || null,
      created_at: now,
    };
    chat.messages[tid] = [...(chat.messages[tid] || []), msg];
    chat.threads[tid] = {
      id: tid,
      user_id: String(body.user_id || tid),
      user_name: body.user_name || chat.threads[tid]?.user_name || "গ্রাহক",
      user_email: body.user_email || chat.threads[tid]?.user_email || "",
      user_phone: body.user_phone || chat.threads[tid]?.user_phone || "",
      last_message_at: now,
      last_message_preview: body.body || "📎 সংযুক্তি",
      user_unread: body.sender_role === "staff" ? 1 : 0,
      staff_unread: body.sender_role === "user" ? 1 : 0,
      created_at: chat.threads[tid]?.created_at || now,
    };
    delete chat.deletedThreads[tid];
    writeLs(LS_CHAT, chat);
    return jsonResp(200, { ok: true, message: msg, thread: chat.threads[tid] });
  }
  if (method === "POST" && apiPath === "/api/chat/delete-thread") {
    const chat = readLs(LS_CHAT, defaultChat);
    const tid = String(body.thread_id || "").trim();
    if (tid) {
      delete chat.threads[tid];
      delete chat.messages[tid];
      chat.deletedThreads[tid] = new Date().toISOString();
      writeLs(LS_CHAT, chat);
    }
    return jsonResp(200, { ok: true });
  }
  if (method === "POST" && apiPath === "/api/chat/delete-all-threads") {
    const chat = readLs(LS_CHAT, defaultChat);
    chat.threads = {};
    chat.messages = {};
    chat.deletedAllBefore = new Date().toISOString();
    writeLs(LS_CHAT, chat);
    return jsonResp(200, { ok: true });
  }
  if (method === "POST" && apiPath === "/api/chat/delete-message") {
    const chat = readLs(LS_CHAT, defaultChat);
    const tid = String(body.thread_id || "").trim();
    const mid = String(body.message_id || "").trim();
    if (tid && chat.messages[tid]) {
      chat.messages[tid] = chat.messages[tid].filter((m: any) => m.id !== mid);
    }
    if (mid) {
      chat.deletedMessages = Array.from(new Set([...chat.deletedMessages, mid]));
    }
    writeLs(LS_CHAT, chat);
    return jsonResp(200, { ok: true });
  }

  return jsonResp(200, { ok: true });
}

export function installSafeStaticFallback() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  const nativeFetch = window.fetch.bind(window);

  const wrappedFetch: typeof window.fetch = async (input, init) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input?.url || "";

    const isApiCall =
      urlStr.startsWith("/api/") ||
      urlStr.includes(`${window.location.origin}/api/`);

    if (!isApiCall || urlStr.includes("/api/apps/download") || urlStr.includes("/api/netlify-deploy")) {
      return nativeFetch(input, init);
    }

    const apiPath = urlStr
      .replace(window.location.origin, "")
      .split("?")[0]
      .replace(/\/+$/, "");
    const method = (init?.method || "GET").toUpperCase();
    let parsedBody: Record<string, any> = {};
    if (init?.body && typeof init.body === "string") {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {
        parsedBody = {};
      }
    }

    try {
      const resp = await nativeFetch(input, init);
      const ct = resp.headers.get("content-type") || "";
      if (resp.status !== 404 && ct.includes("application/json")) {
        return resp;
      }
      // Static host returned 404 or index.html for /api/* -> use local/cloud fallback
      return await handleStaticApiFallback(apiPath, method, parsedBody);
    } catch {
      return await handleStaticApiFallback(apiPath, method, parsedBody);
    }
  };

  try {
    Object.defineProperty(window, "fetch", {
      value: wrappedFetch,
      configurable: true,
      writable: true,
    });
  } catch {
    // Never throw if window.fetch is non-configurable
  }
}
