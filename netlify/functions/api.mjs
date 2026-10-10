import crypto from "crypto";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

const TMP_DIR = "/tmp/smart-noakhali-data";
const BUNDLED_DATA_DIR = path.resolve(process.cwd(), "public", "data");

function ensureTmpDir() {
  try {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  } catch {
    // ignore
  }
}

function readJsonStore(filename, fallback) {
  ensureTmpDir();
  const tmpFile = path.join(TMP_DIR, filename);
  const bundledFile = path.join(BUNDLED_DATA_DIR, filename);
  try {
    if (fs.existsSync(tmpFile)) {
      return JSON.parse(fs.readFileSync(tmpFile, "utf-8"));
    }
    if (fs.existsSync(bundledFile)) {
      const data = JSON.parse(fs.readFileSync(bundledFile, "utf-8"));
      try {
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
      } catch {
        // ignore
      }
      return data;
    }
  } catch {
    // ignore
  }
  return fallback;
}

function writeJsonStore(filename, data) {
  ensureTmpDir();
  const tmpFile = path.join(TMP_DIR, filename);
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

function toEnglishDigits(str = "") {
  const map = {
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

function normalizePhone(raw = "") {
  const digits = toEnglishDigits(raw).replace(/\D/g, "");
  if (digits.startsWith("8801") && digits.length === 13) return digits.slice(2);
  if (digits.startsWith("01") && digits.length === 11) return digits;
  if (digits.startsWith("1") && digits.length === 10) return `0${digits}`;
  return digits;
}

function readOtpGatewayConfig() {
  const saved = readJsonStore("otp_gateway_config.json", {});
  return {
    smtpHost: saved.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com",
    smtpPort: Number(saved.smtpPort || process.env.SMTP_PORT || 465),
    smtpUser: saved.smtpUser || process.env.SMTP_USER || "",
    smtpPass: saved.smtpPass || process.env.SMTP_PASS || "",
    smtpFrom: saved.smtpFrom || process.env.SMTP_FROM || saved.smtpUser || process.env.SMTP_USER || "",
    resendApiKey: saved.resendApiKey || process.env.RESEND_API_KEY || "",
    smsApiUrl: saved.smsApiUrl || process.env.SMS_API_URL || "http://bulksmsbd.net/api/smsapi",
    smsApiKey: saved.smsApiKey || process.env.SMS_API_KEY || "",
    smsSenderId: saved.smsSenderId || process.env.SMS_SENDER_ID || "8809617611061",
  };
}

async function sendEmailOtp(toEmail, code) {
  const cfg = readOtpGatewayConfig();
  const subject = `আপনার ৬ সংখ্যার ভেরিফিকেশন কোড: ${code} — স্মার্ট নোয়াখালী`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border-radius:16px;border:1px solid #d1fae5;background:#f0fdf4;">
      <h2 style="color:#065f46;margin:0 0 8px 0;">স্মার্ট নোয়াখালী ভেরিফিকেশন</h2>
      <p style="color:#374151;font-size:14px;">আপনার অ্যাকাউন্ট যাচাই করার জন্য ৬ সংখ্যার ভেরিফিকেশন কোড নিচে দেওয়া হলো:</p>
      <div style="margin:20px 0;padding:16px;background:#ffffff;border-radius:12px;text-align:center;border:2px dashed #10b981;">
        <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#047857;font-family:monospace;">${code}</span>
      </div>
      <p style="color:#6b7280;font-size:12px;">এই কোডটি ১০ মিনিটের জন্য কার্যকর থাকবে।</p>
    </div>
  `;

  if (cfg.smtpUser && cfg.smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.smtpHost || "smtp.gmail.com",
        port: Number(cfg.smtpPort || 465),
        secure: Number(cfg.smtpPort || 465) === 465,
        auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
      });
      await transporter.sendMail({
        from: `"Smart Noakhali" <${cfg.smtpFrom || cfg.smtpUser}>`,
        to: toEmail,
        subject,
        html,
      });
      return true;
    } catch {
      // fallback
    }
  }

  if (cfg.resendApiKey) {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: cfg.smtpFrom || "Smart Noakhali <onboarding@resend.dev>",
          to: [toEmail],
          subject,
          html,
        }),
      });
      if (resp.ok) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

async function sendPhoneSmsOtp(phone, code) {
  const cfg = readOtpGatewayConfig();
  if (!cfg.smsApiKey) return false;
  const message = `Smart Noakhali Verification Code: ${code}`;
  const intlPhone = phone.startsWith("88") ? phone : `88${phone}`;
  try {
    const url = new URL(cfg.smsApiUrl || "http://bulksmsbd.net/api/smsapi");
    url.searchParams.set("api_key", cfg.smsApiKey);
    url.searchParams.set("type", "text");
    url.searchParams.set("number", intlPhone);
    url.searchParams.set("senderid", cfg.smsSenderId || "8809617611061");
    url.searchParams.set("message", message);
    const resp = await fetch(url.toString());
    return resp.ok;
  } catch {
    return false;
  }
}

const otpMemoryStore = new Map();

function createOtpToken(targetKey, code, expiresAt) {
  const secret = process.env.OTP_HMAC_SECRET || "smart-noakhali-otp-secret-2026";
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${targetKey}:${code}:${expiresAt}`)
    .digest("hex");
  return `${expiresAt}.${sig}`;
}

function verifyOtpToken(targetKey, cleanCode, otpToken) {
  if (!otpToken || !String(otpToken).includes(".")) return false;
  const [expStr, sig] = String(otpToken).split(".");
  const exp = Number(expStr);
  if (!exp || Date.now() > exp) return false;
  const secret = process.env.OTP_HMAC_SECRET || "smart-noakhali-otp-secret-2026";
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${targetKey}:${cleanCode}:${exp}`)
    .digest("hex");
  return sig === expectedSig;
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

export async function handler(event) {
  const rawPath = event.path || "";
  const apiPath = rawPath
    .replace(/^\/\.netlify\/functions\/api/, "/api")
    .replace(/\/+$/, "");
  const method = (event.httpMethod || "GET").toUpperCase();
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      body = {};
    }
  }

  // 1. OTP Send
  if (method === "POST" && apiPath === "/api/auth/send-otp") {
    const mode = body.channel === "phone" ? "phone" : "email";
    const cleanEmail = String(body.email || "").trim().toLowerCase();
    const cleanPhone = normalizePhone(String(body.phone || ""));

    if (mode === "email" && (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
      return jsonResponse(400, { error: "সঠিক ইমেইল ঠিকানা দিন" });
    }
    if (mode === "phone" && (!cleanPhone || !/^01[3-9]\d{8}$/.test(cleanPhone))) {
      return jsonResponse(400, {
        error: "সঠিক ১১ সংখ্যার মোবাইল নাম্বার দিন (যেমন: 01812345678)",
      });
    }

    const targetKey = mode === "email" ? `email:${cleanEmail}` : `phone:${cleanPhone}`;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const otpToken = createOtpToken(targetKey, code, expiresAt);

    otpMemoryStore.set(targetKey, {
      target: mode === "email" ? cleanEmail : cleanPhone,
      channel: mode,
      code,
      expiresAt,
      verified: false,
      createdAt: new Date().toISOString(),
    });

    if (mode === "phone") {
      const sent = await sendPhoneSmsOtp(cleanPhone, code);
      if (!sent) {
        return jsonResponse(200, {
          ok: true,
          useFirebasePhoneAuth: true,
          channel: "phone",
          target: cleanPhone,
          otpToken,
          message: `${cleanPhone} নাম্বারে ৬ সংখ্যার ভেরিফিকেশন কোড (OTP) পাঠানো হয়েছে`,
        });
      }
    } else {
      await sendEmailOtp(cleanEmail, code);
    }

    return jsonResponse(200, {
      ok: true,
      channel: mode,
      target: mode === "email" ? cleanEmail : cleanPhone,
      otpToken,
      message:
        mode === "email"
          ? `${cleanEmail} ইমেইলে ৬ সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে`
          : `${cleanPhone} নাম্বারে ৬ সংখ্যার ভেরিফিকেশন কোড (OTP) পাঠানো হয়েছে`,
    });
  }

  // 2. OTP Verify
  if (method === "POST" && apiPath === "/api/auth/verify-otp") {
    const mode = body.channel === "phone" ? "phone" : "email";
    const cleanEmail = String(body.email || "").trim().toLowerCase();
    const cleanPhone = normalizePhone(String(body.phone || ""));
    const cleanCode = toEnglishDigits(String(body.code || "")).replace(/\D/g, "").trim();
    const targetKey = mode === "email" ? `email:${cleanEmail}` : `phone:${cleanPhone}`;
    const session = otpMemoryStore.get(targetKey);
    const tokenValid = verifyOtpToken(targetKey, cleanCode, body.otpToken);

    if ((!session || session.code !== cleanCode || Date.now() > session.expiresAt) && !tokenValid) {
      return jsonResponse(400, {
        error: "ভুল বা মেয়াদোত্তীর্ণ ভেরিফিকেশন কোড! সঠিক ৬ সংখ্যার কোডটি দিন।",
      });
    }

    return jsonResponse(200, {
      ok: true,
      verified: true,
      channel: mode,
      target: mode === "email" ? cleanEmail : cleanPhone,
    });
  }

  // 3. Reset Password with OTP
  if (method === "POST" && apiPath === "/api/auth/reset-password-otp") {
    const mode = body.channel === "phone" ? "phone" : "email";
    const cleanEmail = String(body.email || "").trim().toLowerCase();
    const cleanPhone = normalizePhone(String(body.phone || ""));
    const cleanCode = toEnglishDigits(String(body.code || "")).replace(/\D/g, "").trim();
    const pwd = String(body.newPassword || "");

    if (pwd.length < 6) {
      return jsonResponse(400, { error: "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে" });
    }

    const targetKey = mode === "email" ? `email:${cleanEmail}` : `phone:${cleanPhone}`;
    const session = otpMemoryStore.get(targetKey);
    const tokenValid = verifyOtpToken(targetKey, cleanCode, body.otpToken);

    if ((!session || session.code !== cleanCode || Date.now() > session.expiresAt) && !tokenValid) {
      return jsonResponse(400, { error: "ভুল বা মেয়াদোত্তীর্ণ ৬ সংখ্যার ভেরিফিকেশন কোড!" });
    }

    const store = readJsonStore("verified_users_store.json", {});
    for (const [k, u] of Object.entries(store)) {
      const emailMatches = mode === "email" && cleanEmail && String(u.email || "").toLowerCase() === cleanEmail;
      const phoneMatches = mode === "phone" && cleanPhone && normalizePhone(u.phone || "") === cleanPhone;
      if (emailMatches || phoneMatches) {
        store[k] = { ...u, password: pwd, updated_at: new Date().toISOString() };
      }
    }
    writeJsonStore("verified_users_store.json", store);
    return jsonResponse(200, { ok: true, message: "পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!" });
  }

  // 4. Direct password reset
  if (method === "POST" && apiPath === "/api/auth/reset-password-direct") {
    const rawId = String(body.identifier || "").trim().toLowerCase();
    const cleanPhone = normalizePhone(rawId);
    const pwd = String(body.newPassword || "");
    if (!rawId || pwd.length < 6) {
      return jsonResponse(400, { error: "সঠিক তথ্য ও কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন" });
    }
    const store = readJsonStore("verified_users_store.json", {});
    for (const [k, u] of Object.entries(store)) {
      if (
        String(u.uid || "").toLowerCase() === rawId ||
        String(u.email || "").toLowerCase() === rawId ||
        (cleanPhone && normalizePhone(u.phone || "") === cleanPhone)
      ) {
        store[k] = { ...u, password: pwd, updated_at: new Date().toISOString() };
      }
    }
    writeJsonStore("verified_users_store.json", store);
    return jsonResponse(200, { ok: true, updated: true });
  }

  // 5. OTP Gateway Config
  if (apiPath === "/api/admin/otp-config") {
    if (method === "POST") {
      const current = readOtpGatewayConfig();
      const next = { ...current, ...body };
      writeJsonStore("otp_gateway_config.json", next);
      return jsonResponse(200, { ok: true, config: next });
    }
    return jsonResponse(200, { ok: true, config: readOtpGatewayConfig(), activeSessions: [] });
  }

  // 6. Users & Auth Lookup
  if (method === "GET" && apiPath === "/api/auth/users") {
    const store = readJsonStore("verified_users_store.json", {});
    const deletedIds = readJsonStore("deleted_users.json", []);
    const deletedSet = new Set(deletedIds.map((x) => String(x).toLowerCase()));

    try {
      const content = readJsonStore("content_store.json", {});
      for (const mirrorKey of ["user_registry_mirror", "super_admin_user_vault"]) {
        const rawMirror = content[mirrorKey];
        if (typeof rawMirror === "string" && rawMirror.trim()) {
          const parsed = JSON.parse(rawMirror);
          const mirrorUsers = parsed?.users && typeof parsed.users === "object" ? parsed.users : parsed;
          if (mirrorUsers && typeof mirrorUsers === "object") {
            for (const u of Object.values(mirrorUsers)) {
              if (!u || typeof u !== "object") continue;
              const uid = String(u.uid || u.email || "").trim();
              const email = String(u.email || "").trim().toLowerCase();
              if (!uid && !email) continue;
              const key = uid || email;
              if (!store[key]) {
                store[key] = {
                  uid: key,
                  email: email || `${key}@user.smartnoakhali.app`,
                  phone: normalizePhone(String(u.phone || "")),
                  password: u.password,
                  full_name: u.full_name || email.split("@")[0] || "ইউজার",
                  username: u.username || email.split("@")[0] || "user",
                  verified_via: u.verified_via || "email",
                  is_verified: true,
                  roles: Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : ["user"],
                  photo_url: u.photo_url,
                  designation: u.designation,
                  suspended: Boolean(u.suspended),
                  created_at: u.created_at || u.updated_at || new Date().toISOString(),
                  updated_at: u.updated_at || new Date().toISOString(),
                };
              }
            }
          }
        }
      }

      const chatStore = readJsonStore("live_chat_store.json", { threads: {} });
      for (const t of Object.values(chatStore.threads || {})) {
        const uid = String(t.user_id || t.id || "").trim();
        const email = String(t.user_email || "").trim().toLowerCase();
        if (!uid) continue;
        const alreadyExists =
          store[uid] ||
          (email && Object.values(store).some((x) => String(x.email || "").toLowerCase() === email));
        if (!alreadyExists) {
          store[uid] = {
            uid,
            email: email || `${uid}@chat.smartnoakhali.app`,
            phone: normalizePhone(String(t.user_phone || "")),
            full_name: t.user_name || "গ্রাহক",
            username: email ? email.split("@")[0] : uid.slice(0, 12),
            verified_via: "email",
            is_verified: true,
            roles: ["user"],
            suspended: false,
            created_at: t.created_at || new Date().toISOString(),
            updated_at: t.last_message_at || new Date().toISOString(),
          };
        }
      }
    } catch {
      // ignore
    }

    const activeUsers = Object.values(store).filter(
      (u) =>
        !deletedSet.has(String(u.uid || "").toLowerCase()) &&
        (!u.email || !deletedSet.has(String(u.email).toLowerCase()))
    );
    return jsonResponse(200, { ok: true, users: activeUsers, deletedIds });
  }

  if (method === "POST" && apiPath === "/api/auth/sync-user") {
    const cleanEmail = String(body.email || "").trim().toLowerCase();
    const cleanPhone = normalizePhone(String(body.phone || ""));
    const uid = String(body.uid || cleanEmail || cleanPhone || `u_${Date.now()}`).trim();
    const store = readJsonStore("verified_users_store.json", {});
    const existing = store[uid] || {};
    const now = new Date().toISOString();
    const record = {
      ...existing,
      ...body,
      uid: existing.uid || uid,
      email: cleanEmail || existing.email || "",
      phone: cleanPhone || existing.phone || "",
      updated_at: now,
      created_at: existing.created_at || now,
    };
    store[record.uid] = record;
    writeJsonStore("verified_users_store.json", store);
    return jsonResponse(200, { ok: true, user: record });
  }

  if (method === "POST" && apiPath === "/api/auth/delete-user") {
    const uid = String(body.user_id || "").trim();
    const cleanEmail = String(body.email || "").trim().toLowerCase();
    if (cleanEmail === "mdmahmudulhashan0@gmail.com" || uid.toLowerCase() === "super_admin_mahmudul") {
      return jsonResponse(403, { error: "মেইন সুপার এডমিন রিমোভ করা যাবে না।" });
    }
    const store = readJsonStore("verified_users_store.json", {});
    const deleted = new Set(readJsonStore("deleted_users.json", []));
    if (uid) deleted.add(uid);
    if (cleanEmail) deleted.add(cleanEmail);
    for (const [k, u] of Object.entries(store)) {
      if (k === uid || u.uid === uid || (cleanEmail && String(u.email || "").toLowerCase() === cleanEmail)) {
        delete store[k];
      }
    }
    writeJsonStore("verified_users_store.json", store);
    writeJsonStore("deleted_users.json", Array.from(deleted));
    return jsonResponse(200, { ok: true });
  }

  if (
    method === "POST" &&
    (apiPath === "/api/auth/login-lookup" || apiPath === "/api/auth/login")
  ) {
    const rawId = String(body.identifier || "").trim();
    const cleanEmail = rawId.toLowerCase();
    const cleanPhone = normalizePhone(rawId);
    const store = readJsonStore("verified_users_store.json", {});
    const users = Object.values(store);
    const matched = users.find(
      (u) =>
        (cleanEmail && String(u.email || "").toLowerCase() === cleanEmail) ||
        (cleanPhone && cleanPhone.length >= 10 && normalizePhone(u.phone || "") === cleanPhone) ||
        (cleanEmail && String(u.username || "").toLowerCase() === cleanEmail)
    );
    if (!matched) {
      return jsonResponse(200, { ok: true, found: false });
    }
    const passwordMatches = Boolean(body.password && matched.password && matched.password === body.password);
    return jsonResponse(200, {
      ok: passwordMatches,
      found: true,
      passwordMatches,
      user: matched,
    });
  }

  // 7. Live Chat Hub Endpoints
  if (method === "GET" && apiPath === "/api/chat/threads") {
    const store = readJsonStore("live_chat_store.json", {
      threads: {},
      messages: {},
      deletedThreads: {},
      deletedAllBefore: null,
      deletedMessages: [],
    });
    const list = Object.values(store.threads || {}).sort((a, b) =>
      String(b.last_message_at || "").localeCompare(String(a.last_message_at || ""))
    );
    return jsonResponse(200, {
      ok: true,
      threads: list,
      messagesByThread: store.messages || {},
      deletedThreads: store.deletedThreads || {},
      deletedAllBefore: store.deletedAllBefore || null,
      deletedMessages: store.deletedMessages || [],
    });
  }

  if (method === "GET" && apiPath.startsWith("/api/chat/messages/")) {
    const threadId = decodeURIComponent(apiPath.replace("/api/chat/messages/", "")).trim();
    const store = readJsonStore("live_chat_store.json", {
      threads: {},
      messages: {},
      deletedThreads: {},
      deletedAllBefore: null,
      deletedMessages: [],
    });
    return jsonResponse(200, {
      ok: true,
      thread: (store.threads || {})[threadId] || null,
      messages: (store.messages || {})[threadId] || [],
      deletedAt: (store.deletedThreads || {})[threadId] || null,
      deletedAllBefore: store.deletedAllBefore || null,
      deletedMessages: store.deletedMessages || [],
    });
  }

  if (method === "POST" && apiPath === "/api/chat/send") {
    const tid = String(body.thread_id || body.user_id || "").trim();
    if (!tid) return jsonResponse(400, { error: "Missing thread_id" });
    const store = readJsonStore("live_chat_store.json", {
      threads: {},
      messages: {},
      deletedThreads: {},
      deletedAllBefore: null,
      deletedMessages: [],
    });
    const now = new Date().toISOString();
    const existing = (store.threads || {})[tid];
    const role = body.sender_role === "staff" ? "staff" : "user";
    const cleanBody = String(body.body || "").trim();
    const cleanAttach = String(body.attachment_url || "").trim();
    const preview = cleanBody || (cleanAttach ? "📎 ফাইল / ভয়েস সংযুক্তি" : "");

    const updatedThread = {
      id: tid,
      user_id: String(body.user_id || existing?.user_id || tid),
      user_name: body.user_name || existing?.user_name || "গ্রাহক",
      user_email: body.user_email || existing?.user_email || "",
      user_phone: body.user_phone || existing?.user_phone || "",
      last_message_at: now,
      last_message_preview: preview,
      user_unread: role === "staff" ? (existing?.user_unread || 0) + 1 : existing?.user_unread || 0,
      staff_unread: role === "user" ? (existing?.staff_unread || 0) + 1 : 0,
      created_at: existing?.created_at || now,
    };

    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      thread_id: tid,
      sender_id: String(body.sender_id || tid),
      sender_role: role,
      sender_name: body.sender_name || (role === "staff" ? "সাপোর্ট টিম" : updatedThread.user_name),
      sender_photo: body.sender_photo || "",
      sender_role_label: body.sender_role_label || (role === "staff" ? "এডমিন" : "গ্রাহক"),
      body: cleanBody || null,
      attachment_url: cleanAttach || null,
      created_at: now,
    };

    store.threads = store.threads || {};
    store.messages = store.messages || {};
    store.deletedThreads = store.deletedThreads || {};
    delete store.deletedThreads[tid];
    store.threads[tid] = updatedThread;
    store.messages[tid] = [...(store.messages[tid] || []), msg];
    writeJsonStore("live_chat_store.json", store);
    return jsonResponse(200, { ok: true, thread: updatedThread, message: msg });
  }

  if (method === "POST" && apiPath === "/api/chat/mark-read") {
    const tid = String(body.thread_id || "").trim();
    const store = readJsonStore("live_chat_store.json", {
      threads: {},
      messages: {},
      deletedThreads: {},
      deletedAllBefore: null,
      deletedMessages: [],
    });
    if (tid && store.threads?.[tid]) {
      if (body.for_role === "staff") store.threads[tid].staff_unread = 0;
      else store.threads[tid].user_unread = 0;
      writeJsonStore("live_chat_store.json", store);
    }
    return jsonResponse(200, { ok: true });
  }

  if (method === "POST" && apiPath === "/api/chat/delete-thread") {
    const tid = String(body.thread_id || "").trim();
    const store = readJsonStore("live_chat_store.json", {
      threads: {},
      messages: {},
      deletedThreads: {},
      deletedAllBefore: null,
      deletedMessages: [],
    });
    const now = new Date().toISOString();
    if (body.delete_all) {
      for (const k of Object.keys(store.threads || {})) {
        store.deletedThreads[k] = now;
      }
      store.threads = {};
      store.messages = {};
      store.deletedAllBefore = now;
    } else if (tid) {
      delete store.threads[tid];
      delete store.messages[tid];
      store.deletedThreads = store.deletedThreads || {};
      store.deletedThreads[tid] = now;
    }
    writeJsonStore("live_chat_store.json", store);
    return jsonResponse(200, {
      ok: true,
      deletedThreads: store.deletedThreads,
      deletedAllBefore: store.deletedAllBefore,
    });
  }

  if (method === "POST" && apiPath === "/api/chat/delete-message") {
    const tid = String(body.thread_id || "").trim();
    const mid = String(body.message_id || "").trim();
    const store = readJsonStore("live_chat_store.json", {
      threads: {},
      messages: {},
      deletedThreads: {},
      deletedAllBefore: null,
      deletedMessages: [],
    });
    if (tid && mid && Array.isArray(store.messages?.[tid])) {
      store.messages[tid] = store.messages[tid].filter((m) => m.id !== mid);
    }
    if (mid) {
      store.deletedMessages = Array.from(new Set([...(store.deletedMessages || []), mid]));
    }
    writeJsonStore("live_chat_store.json", store);
    return jsonResponse(200, { ok: true, deletedMessages: store.deletedMessages });
  }

  // 8. Content store endpoints
  if (method === "GET" && apiPath === "/api/content") {
    return jsonResponse(200, readJsonStore("content_store.json", {}));
  }
  if (method === "POST" && apiPath === "/api/content/sync") {
    const current = readJsonStore("content_store.json", {});
    const merged = { ...current, ...body, updatedAt: new Date().toISOString() };
    if (current.cloud_mirror || body.cloud_mirror) {
      const existing = current.cloud_mirror || {};
      const incoming = body.cloud_mirror || {};
      const collections = { ...(existing.collections || {}) };
      const deletedIds = { ...(existing.deletedIds || {}) };
      if (incoming.deletedIds && typeof incoming.deletedIds === "object") {
        for (const [col, delMap] of Object.entries(incoming.deletedIds)) {
          if (!delMap || typeof delMap !== "object") continue;
          deletedIds[col] = { ...(deletedIds[col] || {}) };
          for (const [docId, delAt] of Object.entries(delMap)) {
            const prevDel = deletedIds[col][docId];
            if (!prevDel || String(delAt) > prevDel) {
              deletedIds[col][docId] = String(delAt);
            }
          }
        }
      }
      if (incoming.collections && typeof incoming.collections === "object") {
        for (const [col, docMap] of Object.entries(incoming.collections)) {
          if (!docMap || typeof docMap !== "object") continue;
          collections[col] = { ...(collections[col] || {}) };
          for (const [docId, docVal] of Object.entries(docMap)) {
            if (!docVal || typeof docVal !== "object") continue;
            const prevDoc = collections[col][docId];
            const nextUpdated = String(docVal.updated_at || docVal.created_at || "");
            const prevUpdated = prevDoc ? String(prevDoc.updated_at || prevDoc.created_at || "") : "";
            if (!prevDoc || nextUpdated >= prevUpdated) {
              collections[col][docId] = docVal;
            }
          }
        }
      }
      for (const [col, delMap] of Object.entries(deletedIds)) {
        if (!collections[col]) continue;
        for (const [docId, delAt] of Object.entries(delMap)) {
          const docVal = collections[col][docId];
          if (docVal) {
            const docUpd = String(docVal.updated_at || docVal.created_at || "");
            if (docUpd > delAt) {
              delete deletedIds[col][docId];
            } else {
              delete collections[col][docId];
            }
          }
        }
      }
      merged.cloud_mirror = {
        collections,
        deletedIds,
        updatedAt: new Date().toISOString(),
      };
    }
    writeJsonStore("content_store.json", merged);
    return jsonResponse(200, { ok: true, store: merged });
  }

  // 9. Staff Activity & Deletion Audit endpoints
  if (method === "GET" && apiPath === "/api/audit/logs") {
    const logs = readJsonStore("staff_audit_logs.json", []);
    return jsonResponse(200, { ok: true, logs: Array.isArray(logs) ? logs : [] });
  }
  if (method === "POST" && apiPath === "/api/audit/record") {
    const entry = body.entry;
    if (entry && typeof entry === "object" && entry.id) {
      const current = readJsonStore("staff_audit_logs.json", []);
      const list = Array.isArray(current) ? current : [];
      const next = [entry, ...list.filter((x) => x.id !== entry.id)].slice(0, 300);
      writeJsonStore("staff_audit_logs.json", next);
      return jsonResponse(200, { ok: true, count: next.length });
    }
    return jsonResponse(200, { ok: false });
  }
  if (method === "POST" && apiPath === "/api/audit/mark-restored") {
    const id = String(body.id || "").trim();
    if (id) {
      const current = readJsonStore("staff_audit_logs.json", []);
      const list = Array.isArray(current) ? current : [];
      writeJsonStore(
        "staff_audit_logs.json",
        list.map((x) => (x.id === id ? { ...x, restored: true } : x))
      );
    }
    return jsonResponse(200, { ok: true });
  }
  if (method === "POST" && apiPath === "/api/audit/clear") {
    writeJsonStore("staff_audit_logs.json", []);
    return jsonResponse(200, { ok: true });
  }

  // 10. Mobile App Package Status, Upload, Delete & Direct Binary Download (/api/apps/*)
  if (method === "GET" && apiPath === "/api/apps/status") {
    const manifest = readJsonStore("app_packages_manifest.json", {});
    for (const plat of ["android", "ios"]) {
      const m = manifest[plat];
      if (m?.savedFile) {
        const p = path.join(TMP_DIR, m.savedFile);
        if (fs.existsSync(p)) {
          try {
            const st = fs.statSync(p);
            if (st.size > 0) m.fileSize = st.size;
          } catch {
            // ignore
          }
        }
      }
    }
    return jsonResponse(200, { ok: true, apps: manifest });
  }

  if (method === "POST" && apiPath === "/api/apps/upload-chunk") {
    const platform = body.platform === "ios" ? "ios" : body.platform === "android" ? "android" : "";
    const uploadId = String(body.uploadId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const chunkBase64 = body.chunkBase64;
    if (!platform || !uploadId || typeof chunkBase64 !== "string") {
      return jsonResponse(400, { error: "অবৈধ আপলোড চাঙ্ক ডাটা" });
    }
    ensureTmpDir();
    const tempPath = path.join(TMP_DIR, `.upload_${platform}_${uploadId}.part`);
    if (Number(body.chunkIndex) === 0 && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
    }
    const cleanB64 = chunkBase64.includes(",") ? chunkBase64.split(",")[1] : chunkBase64;
    const chunkBuf = Buffer.from(cleanB64, "base64");
    fs.appendFileSync(tempPath, chunkBuf);
    const st = fs.statSync(tempPath);
    return jsonResponse(200, { ok: true, chunkIndex: Number(body.chunkIndex) || 0, currentBytes: st.size });
  }

  if (method === "POST" && apiPath === "/api/apps/finalize-upload") {
    const platform = body.platform === "ios" ? "ios" : body.platform === "android" ? "android" : "";
    const uploadId = String(body.uploadId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!platform || !uploadId) {
      return jsonResponse(400, { error: "অবৈধ প্ল্যাটফর্ম বা আপলোড আইডি" });
    }
    ensureTmpDir();
    const tempPath = path.join(TMP_DIR, `.upload_${platform}_${uploadId}.part`);
    if (!fs.existsSync(tempPath)) {
      return jsonResponse(404, { error: "আপলোডকৃত টেম্প ফাইল পাওয়া যায়নি" });
    }
    const st = fs.statSync(tempPath);
    if (body.expectedSize && Number(body.expectedSize) > 0 && st.size !== Number(body.expectedSize)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
      return jsonResponse(400, {
        error: `ফাইল সাইজ মিলেনি (আপলোড: ${body.expectedSize} বাইট, প্রাপ্ত: ${st.size} বাইট)।`,
      });
    }
    const defaultExt = platform === "android" ? ".apk" : ".ipa";
    const safeOriginal = String(body.fileName || `smart-noakhali-${platform}${defaultExt}`)
      .replace(/\s+\./g, ".")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const savedFile = `smart-noakhali-${platform}-${Date.now()}-${safeOriginal}`;
    const targetPath = path.join(TMP_DIR, savedFile);

    const manifest = readJsonStore("app_packages_manifest.json", {});
    const prev = manifest[platform];
    if (prev?.savedFile) {
      try {
        const oldPath = path.join(TMP_DIR, prev.savedFile);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch {
        // ignore
      }
    }
    fs.renameSync(tempPath, targetPath);
    const finalStat = fs.statSync(targetPath);
    const meta = {
      platform,
      fileName: safeOriginal,
      fileSize: finalStat.size,
      version: String(body.version || "2.0.0").trim(),
      label: body.label ? String(body.label).trim() : undefined,
      releaseNotes: body.releaseNotes ? String(body.releaseNotes).trim() : undefined,
      visible: body.visible ?? true,
      mimeType:
        platform === "android"
          ? "application/vnd.android.package-archive"
          : body.mimeType || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
      savedFile,
      downloadUrl: `/api/apps/download/${platform}`,
    };
    manifest[platform] = meta;
    writeJsonStore("app_packages_manifest.json", manifest);
    return jsonResponse(200, { ok: true, meta, downloadUrl: `/api/apps/download/${platform}` });
  }

  if (method === "POST" && apiPath === "/api/apps/update-meta") {
    const platform = body.platform === "ios" ? "ios" : body.platform === "android" ? "android" : "";
    if (!platform) return jsonResponse(400, { error: "অবৈধ প্ল্যাটফর্ম" });
    const manifest = readJsonStore("app_packages_manifest.json", {});
    if (manifest[platform]) {
      manifest[platform] = {
        ...manifest[platform],
        label: body.label !== undefined ? String(body.label).trim() : manifest[platform].label,
        version: body.version !== undefined ? String(body.version).trim() : manifest[platform].version,
        releaseNotes:
          body.releaseNotes !== undefined
            ? String(body.releaseNotes).trim()
            : manifest[platform].releaseNotes,
        visible: body.visible !== undefined ? Boolean(body.visible) : manifest[platform].visible,
      };
      writeJsonStore("app_packages_manifest.json", manifest);
    }
    return jsonResponse(200, { ok: true, meta: manifest[platform] || null });
  }

  if (method === "POST" && apiPath === "/api/apps/delete") {
    const platform = body.platform === "ios" ? "ios" : body.platform === "android" ? "android" : "";
    if (!platform) {
      return jsonResponse(400, { error: "অবৈধ প্ল্যাটফর্ম" });
    }
    const manifest = readJsonStore("app_packages_manifest.json", {});
    const prev = manifest[platform];
    if (prev?.savedFile) {
      try {
        const p = path.join(TMP_DIR, prev.savedFile);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // ignore
      }
    }
    delete manifest[platform];
    writeJsonStore("app_packages_manifest.json", manifest);
    return jsonResponse(200, { ok: true, apps: manifest });
  }

  if (method === "POST" && apiPath === "/api/apps/upload") {
    const platform = body.platform === "ios" ? "ios" : body.platform === "android" ? "android" : "";
    const fileDataBase64 = body.fileDataBase64;
    if (!platform || !fileDataBase64 || typeof fileDataBase64 !== "string") {
      return jsonResponse(400, { error: "অবৈধ অ্যাপ ফাইল বা প্ল্যাটফর্ম" });
    }
    ensureTmpDir();
    const base64Clean = fileDataBase64.includes(",")
      ? fileDataBase64.split(",")[1]
      : fileDataBase64;
    const buffer = Buffer.from(base64Clean, "base64");
    const defaultExt = platform === "android" ? ".apk" : ".ipa";
    const safeOriginal = String(body.fileName || `app-${platform}${defaultExt}`)
      .replace(/\s+\./g, ".")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const savedFile = `smart-noakhali-${platform}-${Date.now()}-${safeOriginal}`;
    try {
      fs.writeFileSync(path.join(TMP_DIR, savedFile), buffer);
    } catch {
      // ignore
    }
    const manifest = readJsonStore("app_packages_manifest.json", {});
    const meta = {
      platform,
      fileName: safeOriginal,
      fileSize: buffer.length,
      version: String(body.version || "2.0.0").trim(),
      label: body.label ? String(body.label).trim() : undefined,
      releaseNotes: body.releaseNotes ? String(body.releaseNotes).trim() : undefined,
      visible: body.visible ?? true,
      mimeType:
        platform === "android"
          ? "application/vnd.android.package-archive"
          : body.mimeType || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
      savedFile,
      downloadUrl: `/api/apps/download/${platform}`,
    };
    manifest[platform] = meta;
    writeJsonStore("app_packages_manifest.json", manifest);
    return jsonResponse(200, {
      ok: true,
      meta,
      downloadUrl: `/api/apps/download/${platform}`,
    });
  }

  if (method === "GET" && apiPath.startsWith("/api/apps/download/")) {
    const platform = apiPath.endsWith("/ios") ? "ios" : "android";
    const manifest = readJsonStore("app_packages_manifest.json", {});
    const meta = manifest[platform] || {};
    const defaultMime =
      platform === "android"
        ? "application/vnd.android.package-archive"
        : "application/octet-stream";
    const bundledDownloadsDir = path.resolve(process.cwd(), "public", "downloads");

    const candidates = [
      meta.savedFile ? path.join(TMP_DIR, meta.savedFile) : "",
      meta.savedFile ? path.join(bundledDownloadsDir, meta.savedFile) : "",
    ].filter(Boolean);

    for (const candidatePath of candidates) {
      try {
        if (fs.existsSync(candidatePath)) {
          const buf = fs.readFileSync(candidatePath);
          const cleanName = String(
            meta.fileName || (platform === "android" ? "app.apk" : "app.ipa")
          )
            .replace(/\s+\./g, ".")
            .replace(/\.json$/i, "");
          return {
            statusCode: 200,
            isBase64Encoded: true,
            headers: {
              "Content-Type": meta.mimeType || defaultMime,
              "Content-Length": String(buf.length),
              "X-Exact-File-Size": String(buf.length),
              "X-Exact-File-Name": cleanName,
              "Content-Disposition": `attachment; filename="${cleanName}"`,
              "Cache-Control": "no-store, no-transform",
            },
            body: buf.toString("base64"),
          };
        }
      } catch {
        // try next candidate
      }
    }

    return jsonResponse(404, {
      error: "এখনও কোনো অ্যাপ ফাইল আপলোড করা হয়নি। সুপার এডমিন ড্যাশবোর্ড থেকে ফাইল আপলোড করুন।",
    });
  }

  return jsonResponse(200, { ok: true });
}

