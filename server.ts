import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOWNLOADS_DIR = path.resolve(__dirname, "public", "downloads");
const DATA_DIR = path.resolve(__dirname, "public", "data");
const MANIFEST_PATH = path.join(DATA_DIR, "app_packages_manifest.json");
const CHAT_STORE_PATH = path.join(DATA_DIR, "live_chat_store.json");
const AUTH_USERS_PATH = path.join(DATA_DIR, "verified_users_store.json");
const DELETED_USERS_PATH = path.join(DATA_DIR, "deleted_users.json");
const OTP_SESSIONS_PATH = path.join(DATA_DIR, "otp_sessions.json");
const OTP_CONFIG_PATH = path.join(DATA_DIR, "otp_gateway_config.json");

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface AppBinaryMeta {
  platform: "android" | "ios";
  fileName: string;
  fileSize: number;
  version: string;
  label?: string;
  releaseNotes?: string;
  visible?: boolean;
  mimeType: string;
  uploadedAt: string;
  savedFile: string;
  downloadUrl?: string;
}

function readManifest(): Record<string, AppBinaryMeta> {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

function writeManifest(data: Record<string, AppBinaryMeta>) {
  try {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write app manifest:", err);
  }
}

// ============================================================================
// Persistent Live Chat Store & Auth OTP Store Helpers
// ============================================================================
export interface ServerChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: "user" | "staff";
  sender_name?: string;
  sender_photo?: string;
  sender_role_label?: string;
  body: string | null;
  attachment_url: string | null;
  created_at: string;
}

export interface ServerChatThread {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone: string;
  last_message_at: string;
  last_message_preview: string | null;
  user_unread: number;
  staff_unread: number;
  created_at: string;
}

interface ChatStoreData {
  threads: Record<string, ServerChatThread>;
  messages: Record<string, ServerChatMessage[]>;
  deletedThreads: Record<string, string>;
  deletedAllBefore: string | null;
  deletedMessages: string[];
}

function readChatStore(): ChatStoreData {
  try {
    if (fs.existsSync(CHAT_STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CHAT_STORE_PATH, "utf-8"));
      if (parsed && typeof parsed === "object") {
        return {
          threads: parsed.threads || {},
          messages: parsed.messages || {},
          deletedThreads: parsed.deletedThreads || {},
          deletedAllBefore: parsed.deletedAllBefore || null,
          deletedMessages: Array.isArray(parsed.deletedMessages) ? parsed.deletedMessages : [],
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    threads: {},
    messages: {},
    deletedThreads: {},
    deletedAllBefore: null,
    deletedMessages: [],
  };
}

function writeChatStore(data: ChatStoreData) {
  try {
    fs.writeFileSync(CHAT_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write chat store:", err);
  }
}

interface VerifiedUserRecord {
  uid: string;
  email: string;
  phone: string;
  password?: string;
  full_name: string;
  username: string;
  verified_via: "email" | "phone" | "google";
  is_verified: boolean;
  roles: string[];
  photo_url?: string;
  designation?: string;
  suspended?: boolean;
  created_at: string;
  updated_at: string;
}

function readVerifiedUsers(): Record<string, VerifiedUserRecord> {
  try {
    if (fs.existsSync(AUTH_USERS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(AUTH_USERS_PATH, "utf-8"));
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeVerifiedUsers(data: Record<string, VerifiedUserRecord>) {
  try {
    fs.writeFileSync(AUTH_USERS_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write verified users:", err);
  }
}

function readDeletedUsers(): string[] {
  try {
    if (fs.existsSync(DELETED_USERS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(DELETED_USERS_PATH, "utf-8"));
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    }
  } catch {
    // ignore
  }
  return [];
}

function writeDeletedUsers(list: string[]) {
  try {
    const unique = Array.from(new Set(list.filter(Boolean)));
    fs.writeFileSync(DELETED_USERS_PATH, JSON.stringify(unique, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write deleted users:", err);
  }
}

interface OtpSession {
  target: string;
  channel: "email" | "phone";
  code: string;
  expiresAt: number;
  verified: boolean;
  createdAt?: string;
}

interface OtpGatewayConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFromName: string;
  resendApiKey: string;
  bulksmsApiKey: string;
  bulksmsSenderId: string;
  greenwebToken: string;
  customSmsUrl: string;
}

function readOtpGatewayConfig(): OtpGatewayConfig {
  const defaults: OtpGatewayConfig = {
    smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
    smtpPort: Number(process.env.SMTP_PORT) || 465,
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    smtpFromName: process.env.SMTP_FROM_NAME || "স্মার্ট নোয়াখালী (Smart Noakhali)",
    resendApiKey: process.env.RESEND_API_KEY || "",
    bulksmsApiKey: process.env.BULKSMSBD_API_KEY || "",
    bulksmsSenderId: process.env.BULKSMSBD_SENDER_ID || "8809617611000",
    greenwebToken: process.env.GREENWEB_TOKEN || "",
    customSmsUrl: process.env.SMS_API_URL || "",
  };
  try {
    if (fs.existsSync(OTP_CONFIG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(OTP_CONFIG_PATH, "utf-8"));
      if (parsed && typeof parsed === "object") {
        return {
          smtpHost: parsed.smtpHost || defaults.smtpHost,
          smtpPort: Number(parsed.smtpPort) || defaults.smtpPort,
          smtpUser: parsed.smtpUser ?? defaults.smtpUser,
          smtpPass: parsed.smtpPass ?? defaults.smtpPass,
          smtpFromName: parsed.smtpFromName || defaults.smtpFromName,
          resendApiKey: parsed.resendApiKey ?? defaults.resendApiKey,
          bulksmsApiKey: parsed.bulksmsApiKey ?? defaults.bulksmsApiKey,
          bulksmsSenderId: parsed.bulksmsSenderId || defaults.bulksmsSenderId,
          greenwebToken: parsed.greenwebToken ?? defaults.greenwebToken,
          customSmsUrl: parsed.customSmsUrl ?? defaults.customSmsUrl,
        };
      }
    }
  } catch {
    // ignore
  }
  return defaults;
}

function writeOtpGatewayConfig(cfg: Partial<OtpGatewayConfig>) {
  try {
    const current = readOtpGatewayConfig();
    const merged = { ...current, ...cfg };
    fs.writeFileSync(OTP_CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write OTP gateway config:", err);
  }
}

const otpMemoryStore = new Map<string, OtpSession>();

function loadOtpSessionsFromDisk() {
  try {
    if (fs.existsSync(OTP_SESSIONS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(OTP_SESSIONS_PATH, "utf-8"));
      if (raw && typeof raw === "object") {
        const now = Date.now();
        for (const [k, v] of Object.entries(raw as Record<string, OtpSession>)) {
          if (v && v.expiresAt > now) {
            otpMemoryStore.set(k, v);
          }
        }
      }
    }
  } catch {
    // ignore
  }
}

function saveOtpSessionsToDisk() {
  try {
    const now = Date.now();
    const obj: Record<string, OtpSession> = {};
    for (const [k, v] of otpMemoryStore.entries()) {
      if (v.expiresAt > now) {
        obj[k] = v;
      }
    }
    fs.writeFileSync(OTP_SESSIONS_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

loadOtpSessionsFromDisk();

function toEnglishDigits(str: string): string {
  const bnDigits = "০১২৩৪৫৬৭৮৯";
  return str.replace(/[০-৯]/g, (ch) => {
    const idx = bnDigits.indexOf(ch);
    return idx >= 0 ? String(idx) : ch;
  });
}

function normalizePhone(raw: string): string {
  const digits = toEnglishDigits(raw).replace(/\D/g, "");
  if (digits.startsWith("8801") && digits.length === 13) {
    return digits.slice(2);
  }
  return digits;
}

async function sendSixDigitEmailOtp(toEmail: string, code: string): Promise<boolean> {
  const cfg = readOtpGatewayConfig();
  const subject = `${code} হলো আপনার স্মার্ট নোয়াখালী ভেরিফিকেশন কোড`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
      <h2 style="color: #064e3b; margin-top: 0; text-align: center;">স্মার্ট নোয়াখালী (Smart Noakhali)</h2>
      <p style="color: #334155; font-size: 14px; text-align: center;">আপনার অ্যাকাউন্ট যাচাইকরণের জন্য ৬ সংখ্যার ভেরিফিকেশন কোড (OTP) নিচে দেওয়া হলো:</p>
      <div style="margin: 20px 0; padding: 16px; background: #ecfdf5; border: 2px dashed #10b981; border-radius: 12px; text-align: center;">
        <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #065f46;">${code}</span>
      </div>
      <p style="color: #64748b; font-size: 12px; text-align: center;">এই কোডটি আগামী ১০ মিনিট কার্যকর থাকবে। নিরাপত্তার স্বার্থে কোডটি কারো সাথে শেয়ার করবেন না।</p>
    </div>
  `;

  if (cfg.smtpUser && cfg.smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.smtpHost || "smtp.gmail.com",
        port: Number(cfg.smtpPort) || 465,
        secure: (Number(cfg.smtpPort) || 465) === 465,
        auth: {
          user: cfg.smtpUser,
          pass: cfg.smtpPass,
        },
      });
      await transporter.sendMail({
        from: `"${cfg.smtpFromName}" <${cfg.smtpUser}>`,
        to: toEmail,
        subject,
        html: htmlBody,
      });
      return true;
    } catch (err) {
      console.error("SMTP OTP send error:", err);
    }
  }

  if (cfg.resendApiKey) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "Smart Noakhali <onboarding@resend.dev>",
          to: [toEmail],
          subject,
          html: htmlBody,
        }),
      });
      if (r.ok) return true;
    } catch (err) {
      console.error("Resend OTP send error:", err);
    }
  }

  return false;
}

async function sendSixDigitPhoneSmsOtp(cleanPhone: string, code: string): Promise<boolean> {
  const cfg = readOtpGatewayConfig();
  const smsMsg = `Smart Noakhali ভেরিফিকেশন কোড (OTP): ${code}। কোডটি ১০ মিনিট কার্যকর থাকবে।`;

  if (cfg.bulksmsApiKey) {
    try {
      const url = `http://bulksmsbd.net/api/smsapi?api_key=${encodeURIComponent(
        cfg.bulksmsApiKey
      )}&type=text&number=88${cleanPhone}&senderid=${encodeURIComponent(
        cfg.bulksmsSenderId || "8809617611000"
      )}&message=${encodeURIComponent(smsMsg)}`;
      const r = await fetch(url);
      if (r.ok) return true;
    } catch (err) {
      console.error("BulkSMSBD error:", err);
    }
  }

  if (cfg.greenwebToken) {
    try {
      const params = new URLSearchParams({
        token: cfg.greenwebToken,
        to: cleanPhone,
        message: smsMsg,
      });
      const r = await fetch(`http://api.greenweb.com.bd/api.php?${params.toString()}`);
      if (r.ok) return true;
    } catch (err) {
      console.error("GreenWeb SMS error:", err);
    }
  }

  if (cfg.customSmsUrl) {
    try {
      const r = await fetch(cfg.customSmsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `88${cleanPhone}`, message: smsMsg, code }),
      });
      if (r.ok) return true;
    } catch (err) {
      console.error("Custom SMS error:", err);
    }
  }

  return false;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // 301 Canonical redirect: enforce authoritative non-www smartnoakhali.com
  app.use((req, res, next) => {
    const host = (req.headers.host || "").toLowerCase();
    if (host.startsWith("www.smartnoakhali.com")) {
      const url = req.url || "/";
      return res.redirect(301, `https://smartnoakhali.com${url}`);
    }
    next();
  });

  // Support large file uploads for direct Android (.apk) and iOS (.ipa) app packages
  app.use(express.json({ limit: "120mb" }));
  app.use(express.urlencoded({ extended: true, limit: "120mb" }));

  // ============================================================================
  // 0. Direct 6-Digit Email / Phone OTP Verification & User Auth Endpoints
  // ============================================================================
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { channel, email, phone } = req.body as {
        channel?: "email" | "phone";
        email?: string;
        phone?: string;
      };

      const mode = channel === "phone" ? "phone" : "email";
      const cleanEmail = String(email || "").trim().toLowerCase();
      const cleanPhone = normalizePhone(String(phone || ""));

      if (mode === "email") {
        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          res.status(400).json({ error: "সঠিক ইমেইল ঠিকানা দিন" });
          return;
        }
      } else {
        if (!cleanPhone || !/^01[3-9]\d{8}$/.test(cleanPhone)) {
          res.status(400).json({
            error: "সঠিক ১১ সংখ্যার মোবাইল নাম্বার দিন (যেমন: 01812345678)",
          });
          return;
        }
      }

      const targetKey = mode === "email" ? `email:${cleanEmail}` : `phone:${cleanPhone}`;
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000;
      const otpSecret = process.env.OTP_HMAC_SECRET || "smart-noakhali-otp-secret-2026";
      const sig = crypto
        .createHmac("sha256", otpSecret)
        .update(`${targetKey}:${code}:${expiresAt}`)
        .digest("hex");
      const otpToken = `${expiresAt}.${sig}`;

      otpMemoryStore.set(targetKey, {
        target: mode === "email" ? cleanEmail : cleanPhone,
        channel: mode,
        code,
        expiresAt,
        verified: false,
        createdAt: new Date().toISOString(),
      });
      saveOtpSessionsToDisk();

      if (mode === "phone") {
        const sentByGateway = await sendSixDigitPhoneSmsOtp(cleanPhone, code);
        if (!sentByGateway) {
          res.json({
            ok: true,
            useFirebasePhoneAuth: true,
            channel: "phone",
            target: cleanPhone,
            otpToken,
            message: `${cleanPhone} নাম্বারে ৬ সংখ্যার ভেরিফিকেশন কোড (OTP) পাঠানো হয়েছে`,
          });
          return;
        }
      } else {
        await sendSixDigitEmailOtp(cleanEmail, code);
      }

      res.json({
        ok: true,
        channel: mode,
        target: mode === "email" ? cleanEmail : cleanPhone,
        otpToken,
        message:
          mode === "email"
            ? `${cleanEmail} ইমেইলে ৬ সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে`
            : `${cleanPhone} নাম্বারে ৬ সংখ্যার ভেরিফিকেশন কোড (OTP) পাঠানো হয়েছে`,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "ভেরিফিকেশন কোড পাঠানো যায়নি",
      });
    }
  });

  function verifyStatelessOtpToken(targetKey: string, cleanCode: string, otpToken?: string): boolean {
    if (!otpToken || !otpToken.includes(".")) return false;
    const [expStr, sig] = otpToken.split(".");
    const exp = Number(expStr);
    if (!exp || Date.now() > exp) return false;
    const otpSecret = process.env.OTP_HMAC_SECRET || "smart-noakhali-otp-secret-2026";
    const expectedSig = crypto
      .createHmac("sha256", otpSecret)
      .update(`${targetKey}:${cleanCode}:${exp}`)
      .digest("hex");
    return sig === expectedSig;
  }

  app.post("/api/auth/verify-otp", (req, res) => {
    try {
      const { channel, email, phone, code, otpToken } = req.body as {
        channel?: "email" | "phone";
        email?: string;
        phone?: string;
        code?: string;
        otpToken?: string;
      };

      const mode = channel === "phone" ? "phone" : "email";
      const cleanEmail = String(email || "").trim().toLowerCase();
      const cleanPhone = normalizePhone(String(phone || ""));
      const cleanCode = toEnglishDigits(String(code || "")).replace(/\D/g, "").trim();

      const targetKey = mode === "email" ? `email:${cleanEmail}` : `phone:${cleanPhone}`;
      const session = otpMemoryStore.get(targetKey);
      const tokenValid = verifyStatelessOtpToken(targetKey, cleanCode, otpToken);

      if (!session && !tokenValid) {
        res.status(400).json({ error: "ভেরিফিকেশন সেশন পাওয়া যায়নি। আবার কোড পাঠান।" });
        return;
      }
      if (session && Date.now() > session.expiresAt && !tokenValid) {
        otpMemoryStore.delete(targetKey);
        saveOtpSessionsToDisk();
        res.status(400).json({ error: "ভেরিফিকেশন কোডের মেয়াদ শেষ। আবার কোড পাঠান।" });
        return;
      }
      if ((!session || session.code !== cleanCode) && !tokenValid) {
        res.status(400).json({ error: "ভুল ভেরিফিকেশন কোড! সঠিক ৬ সংখ্যার কোডটি দিন।" });
        return;
      }

      if (session) {
        session.verified = true;
        otpMemoryStore.set(targetKey, session);
        saveOtpSessionsToDisk();
      }

      res.json({
        ok: true,
        verified: true,
        channel: mode,
        target: mode === "email" ? cleanEmail : cleanPhone,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "ভেরিফিকেশন ব্যর্থ হয়েছে",
      });
    }
  });

  app.post("/api/auth/reset-password-otp", (req, res) => {
    try {
      const { channel, email, phone, code, newPassword, otpToken } = req.body as {
        channel?: "email" | "phone";
        email?: string;
        phone?: string;
        code?: string;
        newPassword?: string;
        otpToken?: string;
      };

      const mode = channel === "phone" ? "phone" : "email";
      const cleanEmail = String(email || "").trim().toLowerCase();
      const cleanPhone = normalizePhone(String(phone || ""));
      const cleanCode = toEnglishDigits(String(code || "")).replace(/\D/g, "").trim();
      const pwd = String(newPassword || "");

      if (pwd.length < 6) {
        res.status(400).json({ error: "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে" });
        return;
      }

      const targetKey = mode === "email" ? `email:${cleanEmail}` : `phone:${cleanPhone}`;
      const session = otpMemoryStore.get(targetKey);
      const tokenValid = verifyStatelessOtpToken(targetKey, cleanCode, otpToken);

      if ((!session || Date.now() > session.expiresAt || session.code !== cleanCode) && !tokenValid) {
        res.status(400).json({ error: "ভুল বা মেয়াদোত্তীর্ণ ৬ সংখ্যার ভেরিফিকেশন কোড!" });
        return;
      }

      const store = readVerifiedUsers();
      let updatedCount = 0;
      for (const [key, u] of Object.entries(store)) {
        const emailMatches = mode === "email" && cleanEmail && u.email.toLowerCase() === cleanEmail;
        const phoneMatches = mode === "phone" && cleanPhone && normalizePhone(u.phone) === cleanPhone;
        if (emailMatches || phoneMatches) {
          store[key] = {
            ...u,
            password: pwd,
            updated_at: new Date().toISOString(),
          };
          updatedCount++;
        }
      }

      if (updatedCount === 0) {
        res.status(404).json({
          error: "এই ইমেইল বা মোবাইল নাম্বারে কোনো নিবন্ধিত অ্যাকাউন্ট পাওয়া যায়নি।",
        });
        return;
      }

      writeVerifiedUsers(store);
      otpMemoryStore.delete(targetKey);
      saveOtpSessionsToDisk();

      res.json({ ok: true, message: "পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!" });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে",
      });
    }
  });

  app.post("/api/auth/reset-password-direct", (req, res) => {
    try {
      const { identifier, newPassword } = req.body as {
        identifier?: string;
        newPassword?: string;
      };
      const rawId = String(identifier || "").trim().toLowerCase();
      const cleanPhone = normalizePhone(rawId);
      const pwd = String(newPassword || "");
      if (!rawId || pwd.length < 6) {
        res.status(400).json({ error: "সঠিক তথ্য ও কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন" });
        return;
      }
      const store = readVerifiedUsers();
      let updated = false;
      for (const [key, u] of Object.entries(store)) {
        if (
          u.uid.toLowerCase() === rawId ||
          (u.email && u.email.toLowerCase() === rawId) ||
          (cleanPhone && u.phone && normalizePhone(u.phone) === cleanPhone)
        ) {
          store[key] = {
            ...u,
            password: pwd,
            updated_at: new Date().toISOString(),
          };
          updated = true;
        }
      }
      if (updated) {
        writeVerifiedUsers(store);
      }
      res.json({ ok: true, updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
    }
  });

  app.get("/api/admin/otp-config", (_req, res) => {
    const cfg = readOtpGatewayConfig();
    const now = Date.now();
    const activeSessions: Array<{
      target: string;
      channel: "email" | "phone";
      code: string;
      expiresAt: number;
    }> = [];
    for (const s of otpMemoryStore.values()) {
      if (s.expiresAt > now) {
        activeSessions.push({
          target: s.target,
          channel: s.channel,
          code: s.code,
          expiresAt: s.expiresAt,
        });
      }
    }
    res.json({ ok: true, config: cfg, activeSessions });
  });

  app.post("/api/admin/otp-config", (req, res) => {
    try {
      const body = req.body as Partial<OtpGatewayConfig>;
      writeOtpGatewayConfig(body);
      res.json({ ok: true, config: readOtpGatewayConfig() });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "কনফিগারেশন সংরক্ষণ ব্যর্থ হয়েছে",
      });
    }
  });

  app.post("/api/auth/sync-user", (req, res) => {
    try {
      const body = req.body as Partial<VerifiedUserRecord>;
      const cleanEmail = String(body.email || "").trim().toLowerCase();
      const cleanPhone = normalizePhone(String(body.phone || ""));
      const uid = String(body.uid || cleanEmail || cleanPhone || `u_${Date.now()}`).trim();
      if (!uid) {
        res.status(400).json({ error: "Missing uid" });
        return;
      }

      // 1. Immediately remove from deleted list on server if user is newly created or re-registered
      const deleted = readDeletedUsers().filter((idOrEmail) => {
        const low = idOrEmail.toLowerCase();
        if (low === uid.toLowerCase()) return false;
        if (cleanEmail && low === cleanEmail) return false;
        if (cleanPhone && low === cleanPhone) return false;
        return true;
      });
      writeDeletedUsers(deleted);

      // 2. Also remove from content_store.json mirrors so it never resurrects
      try {
        const content = readContentStore();
        let changed = false;
        for (const mKey of ["user_registry_mirror", "super_admin_user_vault"]) {
          const raw = content[mKey];
          if (typeof raw === "string" && raw.trim()) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed?.deletedIds)) {
                parsed.deletedIds = parsed.deletedIds.filter((x: string) => {
                  const xLow = String(x).toLowerCase();
                  return xLow !== uid.toLowerCase() && (!cleanEmail || xLow !== cleanEmail);
                });
                content[mKey] = JSON.stringify(parsed);
                changed = true;
              }
            } catch {
              // ignore
            }
          }
        }
        if (changed) writeContentStore(content);
      } catch {
        // ignore
      }

      const store = readVerifiedUsers();
      const existing =
        store[uid] ||
        (cleanEmail ? Object.values(store).find((u) => u.email === cleanEmail) : undefined) ||
        (cleanPhone ? Object.values(store).find((u) => u.phone === cleanPhone) : undefined);

      const now = new Date().toISOString();
      const record: VerifiedUserRecord = {
        uid: existing?.uid || uid,
        email: cleanEmail || existing?.email || (cleanPhone ? `${cleanPhone}@phone.smartnoakhali.app` : ""),
        phone: cleanPhone || existing?.phone || "",
        password: body.password !== undefined ? body.password : existing?.password,
        full_name: body.full_name || existing?.full_name || "ইউজার",
        username: body.username || existing?.username || "user",
        verified_via: body.verified_via || existing?.verified_via || "email",
        is_verified: body.is_verified ?? existing?.is_verified ?? true,
        roles: Array.isArray(body.roles) && body.roles.length > 0 ? body.roles : existing?.roles || ["user"],
        photo_url: body.photo_url !== undefined ? body.photo_url : existing?.photo_url,
        designation: body.designation !== undefined ? body.designation : existing?.designation,
        suspended: body.suspended !== undefined ? body.suspended : existing?.suspended ?? false,
        created_at: existing?.created_at || now,
        updated_at: now,
      };

      store[record.uid] = record;
      writeVerifiedUsers(store);
      res.json({ ok: true, user: record });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Sync failed" });
    }
  });

  app.post("/api/auth/undelete-user", (req, res) => {
    try {
      const { user_id, email } = req.body as { user_id?: string; email?: string };
      const uid = String(user_id || "").trim().toLowerCase();
      const cleanEmail = String(email || "").trim().toLowerCase();

      const prevDeleted = readDeletedUsers();
      const nextDeleted = prevDeleted.filter((idOrEmail) => {
        const low = idOrEmail.toLowerCase();
        if (uid && low === uid) return false;
        if (cleanEmail && low === cleanEmail) return false;
        return true;
      });
      writeDeletedUsers(nextDeleted);

      try {
        const content = readContentStore();
        let changed = false;
        for (const mKey of ["user_registry_mirror", "super_admin_user_vault"]) {
          const raw = content[mKey];
          if (typeof raw === "string" && raw.trim()) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed?.deletedIds)) {
                parsed.deletedIds = parsed.deletedIds.filter((x: string) => {
                  const xLow = String(x).toLowerCase();
                  return (!uid || xLow !== uid) && (!cleanEmail || xLow !== cleanEmail);
                });
                content[mKey] = JSON.stringify(parsed);
                changed = true;
              }
            } catch {
              // ignore
            }
          }
        }
        if (changed) writeContentStore(content);
      } catch {
        // ignore
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Undelete failed" });
    }
  });

  app.post("/api/auth/delete-user", (req, res) => {
    try {
      const { user_id, email } = req.body as { user_id?: string; email?: string };
      const uid = String(user_id || "").trim();
      const cleanEmail = String(email || "").trim().toLowerCase();

      if (
        cleanEmail === "mdmahmudulhashan0@gmail.com" ||
        uid.toLowerCase() === "super_admin_mahmudul"
      ) {
        res.status(403).json({
          error: "মেইন সুপার এডমিন (mdmahmudulhashan0@gmail.com) রিমোভ বা পরিবর্তন করা যাবে না।",
        });
        return;
      }

      const store = readVerifiedUsers();
      const toDeleteKeys: string[] = [];
      const toTrackDeleted: string[] = [];
      if (uid) toTrackDeleted.push(uid);
      if (cleanEmail) toTrackDeleted.push(cleanEmail);

      for (const [k, u] of Object.entries(store)) {
        const matchesId = uid && (k === uid || u.uid === uid);
        const matchesEmail = cleanEmail && u.email && u.email.toLowerCase() === cleanEmail;
        if (matchesId || matchesEmail) {
          toDeleteKeys.push(k);
          if (u.uid) toTrackDeleted.push(u.uid);
          if (u.email) toTrackDeleted.push(u.email.toLowerCase());
        }
      }

      for (const k of toDeleteKeys) {
        delete store[k];
      }
      writeVerifiedUsers(store);

      const prevDeleted = readDeletedUsers();
      writeDeletedUsers([...prevDeleted, ...toTrackDeleted]);

      res.json({ ok: true, deletedKeys: toDeleteKeys });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Delete failed" });
    }
  });

  app.post("/api/auth/login-lookup", (req, res) => {
    try {
      const { identifier, password } = req.body as {
        identifier?: string;
        password?: string;
      };
      const rawId = String(identifier || "").trim();
      const cleanEmail = rawId.toLowerCase();
      const cleanPhone = normalizePhone(rawId);

      const deletedList = readDeletedUsers().map((x) => x.toLowerCase());
      if (cleanEmail && deletedList.includes(cleanEmail)) {
        res.status(403).json({ error: "এই অ্যাকাউন্টটি ডিলিট করা হয়েছে।" });
        return;
      }

      const store = readVerifiedUsers();
      const users = Object.values(store);

      const matched = users.find(
        (u) =>
          (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
          (cleanPhone && cleanPhone.length >= 10 && normalizePhone(u.phone) === cleanPhone) ||
          (cleanEmail && u.username.toLowerCase() === cleanEmail)
      );

      if (!matched) {
        res.json({ ok: true, found: false });
        return;
      }

      if (
        deletedList.includes(matched.uid.toLowerCase()) ||
        (matched.email && deletedList.includes(matched.email.toLowerCase()))
      ) {
        res.status(403).json({ error: "এই অ্যাকাউন্টটি ডিলিট করা হয়েছে।" });
        return;
      }

      if (matched.suspended) {
        res.status(403).json({ error: "আপনার অ্যাকাউন্টটি স্থগিত করা হয়েছে।" });
        return;
      }

      const passwordMatches = Boolean(password && matched.password && matched.password === password);
      res.json({
        ok: true,
        found: true,
        passwordMatches,
        user: {
          uid: matched.uid,
          email: matched.email,
          phone: matched.phone,
          full_name: matched.full_name,
          username: matched.username,
          roles: matched.roles,
          verified_via: matched.verified_via,
          photo_url: matched.photo_url,
          designation: matched.designation,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Lookup failed" });
    }
  });

  app.get("/api/auth/users", (_req, res) => {
    const store = readVerifiedUsers();
    const deletedIds = readDeletedUsers();
    const deletedSet = new Set(deletedIds.map((x) => x.toLowerCase()));

    // Merge users from content_store.json (user_registry_mirror / super_admin_user_vault) and live_chat_store.json
    try {
      const content = readContentStore();
      for (const mirrorKey of ["user_registry_mirror", "super_admin_user_vault"]) {
        const rawMirror = content[mirrorKey];
        if (typeof rawMirror === "string" && rawMirror.trim()) {
          const parsed = JSON.parse(rawMirror);
          const mirrorUsers = parsed?.users && typeof parsed.users === "object" ? parsed.users : parsed;
          if (mirrorUsers && typeof mirrorUsers === "object") {
            for (const u of Object.values(mirrorUsers) as Array< Record<string, any> >) {
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

      const chatStore = readChatStore();
      for (const t of Object.values(chatStore.threads || {})) {
        const uid = String(t.user_id || t.id || "").trim();
        const email = String(t.user_email || "").trim().toLowerCase();
        if (!uid) continue;
        const alreadyExists =
          store[uid] ||
          (email && Object.values(store).some((x) => x.email.toLowerCase() === email));
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
      writeVerifiedUsers(store);
    } catch {
      // ignore merge errors
    }

    const seenMap = new Map<string, VerifiedUserRecord>();
    for (const u of Object.values(store)) {
      if (!u || (!u.uid && !u.email)) continue;
      const uidLow = (u.uid || "").toLowerCase();
      const emLow = (u.email || "").toLowerCase();
      if (
        (uidLow && deletedSet.has(uidLow)) ||
        (emLow && deletedSet.has(emLow))
      ) {
        continue;
      }
      const dedupKey = emLow || uidLow;
      if (!seenMap.has(dedupKey)) {
        seenMap.set(dedupKey, u);
      }
    }
    const activeUsers = Array.from(seenMap.values());
    res.json({ ok: true, users: activeUsers, deletedIds });
  });

  // ============================================================================
  // 0.5 Unified Real-Time Live Chat Hub Endpoints (/api/chat/*)
  // Makes Admin/Editor/Moderator/Customer Live Chat 100% reliable and easy
  // ============================================================================
  app.get("/api/chat/threads", (_req, res) => {
    const store = readChatStore();
    const list = Object.values(store.threads).sort((a, b) =>
      b.last_message_at.localeCompare(a.last_message_at)
    );
    res.json({
      ok: true,
      threads: list,
      messagesByThread: store.messages,
      deletedThreads: store.deletedThreads,
      deletedAllBefore: store.deletedAllBefore,
      deletedMessages: store.deletedMessages,
    });
  });

  app.get("/api/chat/messages/:threadId", (req, res) => {
    const threadId = String(req.params.threadId || "").trim();
    const store = readChatStore();
    res.json({
      ok: true,
      thread: store.threads[threadId] || null,
      messages: store.messages[threadId] || [],
      deletedAt: store.deletedThreads[threadId] || null,
      deletedAllBefore: store.deletedAllBefore,
      deletedMessages: store.deletedMessages,
    });
  });

  app.post("/api/chat/send", (req, res) => {
    try {
      const {
        thread_id,
        user_id,
        user_name,
        user_email,
        user_phone,
        sender_id,
        sender_role,
        sender_name,
        sender_photo,
        sender_role_label,
        body,
        attachment_url,
      } = req.body as {
        thread_id?: string;
        user_id?: string;
        user_name?: string;
        user_email?: string;
        user_phone?: string;
        sender_id?: string;
        sender_role?: "user" | "staff";
        sender_name?: string;
        sender_photo?: string;
        sender_role_label?: string;
        body?: string;
        attachment_url?: string;
      };

      const tid = String(thread_id || user_id || "").trim();
      if (!tid) {
        res.status(400).json({ error: "Missing thread_id" });
        return;
      }

      const store = readChatStore();
      const now = new Date().toISOString();
      const existingThread = store.threads[tid];

      const role: "user" | "staff" = sender_role === "staff" ? "staff" : "user";
      const cleanBody = String(body || "").trim();
      const cleanAttach = String(attachment_url || "").trim();
      const preview = cleanBody || (cleanAttach ? "📎 ফাইল / ভয়েস সংযুক্তি" : "");

      const updatedThread: ServerChatThread = {
        id: tid,
        user_id: String(user_id || existingThread?.user_id || tid),
        user_name:
          (role === "user" && user_name ? user_name : existingThread?.user_name) ||
          user_name ||
          "গ্রাহক",
        user_email:
          (role === "user" && user_email ? user_email : existingThread?.user_email) ||
          user_email ||
          "",
        user_phone:
          (role === "user" && user_phone ? user_phone : existingThread?.user_phone) ||
          user_phone ||
          "",
        last_message_at: now,
        last_message_preview: preview,
        user_unread:
          role === "staff"
            ? (existingThread?.user_unread || 0) + 1
            : existingThread?.user_unread || 0,
        staff_unread:
          role === "user"
            ? (existingThread?.staff_unread || 0) + 1
            : 0, // When staff replies, staff_unread automatically resets to 0
        created_at: existingThread?.created_at || now,
      };

      const msg: ServerChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        thread_id: tid,
        sender_id: String(sender_id || tid),
        sender_role: role,
        sender_name: sender_name || (role === "staff" ? "সাপোর্ট টিম" : updatedThread.user_name),
        sender_photo: sender_photo || "",
        sender_role_label: sender_role_label || (role === "staff" ? "এডমিন" : "গ্রাহক"),
        body: cleanBody || null,
        attachment_url: cleanAttach || null,
        created_at: now,
      };

      delete store.deletedThreads[tid];
      store.threads[tid] = updatedThread;
      const list = store.messages[tid] || [];
      list.push(msg);
      store.messages[tid] = list.slice(-200);
      writeChatStore(store);

      res.json({ ok: true, thread: updatedThread, message: msg });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Send failed" });
    }
  });

  app.post("/api/chat/mark-read", (req, res) => {
    const { thread_id, side } = req.body as { thread_id?: string; side?: "user" | "staff" };
    const tid = String(thread_id || "").trim();
    if (!tid) {
      res.json({ ok: true });
      return;
    }
    const store = readChatStore();
    const t = store.threads[tid];
    if (t) {
      if (side === "staff") t.staff_unread = 0;
      else t.user_unread = 0;
      store.threads[tid] = t;
      writeChatStore(store);
    }
    res.json({ ok: true });
  });

  app.post("/api/chat/delete-thread", (req, res) => {
    const { thread_id } = req.body as { thread_id?: string };
    const tid = String(thread_id || "").trim();
    const now = new Date().toISOString();
    if (tid) {
      const store = readChatStore();
      delete store.threads[tid];
      delete store.messages[tid];
      store.deletedThreads[tid] = now;
      writeChatStore(store);
    }
    res.json({ ok: true, deletedAt: now });
  });

  app.post("/api/chat/delete-message", (req, res) => {
    const { thread_id, message_id } = req.body as { thread_id?: string; message_id?: string };
    const tid = String(thread_id || "").trim();
    const mid = String(message_id || "").trim();
    const now = new Date().toISOString();
    if (tid && mid) {
      const store = readChatStore();
      if (!store.deletedMessages.includes(mid)) {
        store.deletedMessages = [...store.deletedMessages.slice(-500), mid];
      }
      if (Array.isArray(store.messages[tid])) {
        store.messages[tid] = store.messages[tid].filter((m) => m.id !== mid);
        const remaining = store.messages[tid];
        if (remaining.length === 0) {
          delete store.threads[tid];
          delete store.messages[tid];
          store.deletedThreads[tid] = now;
        } else if (store.threads[tid]) {
          const lastMsg = remaining[remaining.length - 1];
          store.threads[tid].last_message_preview = lastMsg
            ? lastMsg.body || (lastMsg.attachment_url ? "📎 ফাইল / ভয়েস সংযুক্তি" : "")
            : "";
          if (lastMsg?.created_at) {
            store.threads[tid].last_message_at = lastMsg.created_at;
          }
        }
      }
      writeChatStore(store);
    }
    res.json({ ok: true });
  });

  app.post("/api/chat/delete-all-threads", (_req, res) => {
    const now = new Date().toISOString();
    const store = readChatStore();
    const nextDeletedThreads: Record<string, string> = { ...store.deletedThreads };
    for (const tid of Object.keys(store.threads)) {
      nextDeletedThreads[tid] = now;
    }
    writeChatStore({
      threads: {},
      messages: {},
      deletedThreads: nextDeletedThreads,
      deletedAllBefore: now,
      deletedMessages: store.deletedMessages || [],
    });
    res.json({ ok: true, deletedAllBefore: now });
  });

  // ============================================================================
  // 0E. Staff Activity & Deletion Audit Log Store (/api/audit/*)
  // ============================================================================
  const AUDIT_STORE_FILE = path.join(DOWNLOADS_DIR, "staff_audit_logs.json");
  function readAuditLogs(): Array<Record<string, unknown>> {
    try {
      if (fs.existsSync(AUDIT_STORE_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(AUDIT_STORE_FILE, "utf8"));
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  }
  function writeAuditLogs(logs: Array<Record<string, unknown>>) {
    try {
      fs.writeFileSync(AUDIT_STORE_FILE, JSON.stringify(logs.slice(0, 300), null, 2));
    } catch {
      // ignore
    }
  }

  app.get("/api/audit/logs", (_req, res) => {
    res.json({ ok: true, logs: readAuditLogs() });
  });

  app.post("/api/audit/record", (req, res) => {
    const { entry } = req.body as { entry?: Record<string, unknown> };
    if (entry && typeof entry === "object" && entry.id) {
      const current = readAuditLogs();
      const filtered = current.filter((x) => x.id !== entry.id);
      const next = [entry, ...filtered].slice(0, 300);
      writeAuditLogs(next);
      res.json({ ok: true, count: next.length });
      return;
    }
    res.json({ ok: false });
  });

  app.post("/api/audit/mark-restored", (req, res) => {
    const { id } = req.body as { id?: string };
    if (id) {
      const current = readAuditLogs().map((x) =>
        x.id === id ? { ...x, restored: true } : x
      );
      writeAuditLogs(current);
    }
    res.json({ ok: true });
  });

  app.post("/api/audit/clear", (_req, res) => {
    writeAuditLogs([]);
    res.json({ ok: true });
  });

  // ============================================================================
  // 0F. Unified Content & Cloud Mirror Store (/api/content & /api/content/sync)
  // ============================================================================
  const CONTENT_STORE_FILE = path.join(DATA_DIR, "content_store.json");
  function readContentStore(): Record<string, any> {
    try {
      if (fs.existsSync(CONTENT_STORE_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(CONTENT_STORE_FILE, "utf8"));
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  }
  function writeContentStore(data: Record<string, any>) {
    try {
      fs.writeFileSync(CONTENT_STORE_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch {
      // ignore
    }
  }
  function mergeCloudMirrorObjects(existing: any, incoming: any) {
    if (!incoming || typeof incoming !== "object") return existing || {};
    if (!existing || typeof existing !== "object") return incoming;
    const collections: Record<string, Record<string, any>> = {
      ...(existing.collections || {}),
    };
    const deletedIds: Record<string, Record<string, string>> = {
      ...(existing.deletedIds || {}),
    };

    if (incoming.deletedIds && typeof incoming.deletedIds === "object") {
      for (const [col, delMap] of Object.entries(incoming.deletedIds)) {
        if (!delMap || typeof delMap !== "object") continue;
        deletedIds[col] = { ...(deletedIds[col] || {}) };
        for (const [docId, delAt] of Object.entries(delMap as Record<string, string>)) {
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
        for (const [docId, docVal] of Object.entries(docMap as Record<string, any>)) {
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

    // Apply tombstones vs newer restorations
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

    return {
      collections,
      deletedIds,
      updatedAt: new Date().toISOString(),
    };
  }

  app.get("/api/content", (req, res) => {
    try {
      const store = readContentStore();
      const collection = typeof req.query.collection === "string" ? req.query.collection.trim() : null;
      const id = typeof req.query.id === "string" ? req.query.id.trim() : null;

      if (collection) {
        const mirror = store.cloud_mirror?.collections || {};
        const colMap = (mirror[collection] || store[collection] || {}) as Record<string, any>;
        if (id) {
          let item = colMap[id] || null;
          if (!item && collection === "settings" && store[id]) {
            item = {
              id,
              key: id,
              logo_url: store[id],
              visible: true,
              updated_at: new Date().toISOString(),
            };
          }
          res.json({ ok: true, item });
          return;
        }
        const items = Object.values(colMap);
        res.json({ ok: true, items });
        return;
      }

      res.json(store);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Content fetch failed" });
    }
  });

  app.post("/api/content/upsert", (req, res) => {
    try {
      const { collection, id, doc } = (req.body || {}) as {
        collection?: string;
        id?: string;
        doc?: Record<string, any>;
      };
      if (!collection || !id || !doc) {
        res.status(400).json({ error: "Missing collection, id, or doc" });
        return;
      }
      const store = readContentStore();
      const mirror = store.cloud_mirror || {
        collections: {},
        deletedIds: {},
        updatedAt: new Date().toISOString(),
      };
      mirror.collections = mirror.collections || {};
      mirror.collections[collection] = mirror.collections[collection] || {};
      const savedDoc = {
        ...doc,
        id,
        created_at: String(doc.created_at || new Date().toISOString()),
        updated_at: String(doc.updated_at || new Date().toISOString()),
      };
      mirror.collections[collection][id] = savedDoc;
      if (mirror.deletedIds?.[collection]) {
        delete mirror.deletedIds[collection][id];
      }
      store.cloud_mirror = mirror;

      // For settings collection, also expose top-level property for easy retrieval
      if (collection === "settings") {
        store[id] = doc.logo_url !== undefined ? doc.logo_url : doc;
      }

      store.updatedAt = new Date().toISOString();
      writeContentStore(store);
      res.json({ ok: true, doc: savedDoc });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Upsert failed" });
    }
  });

  app.post("/api/content/delete", (req, res) => {
    try {
      const { collection, id } = (req.body || {}) as { collection?: string; id?: string };
      if (!collection || !id) {
        res.status(400).json({ error: "Missing collection or id" });
        return;
      }
      const store = readContentStore();
      const mirror = store.cloud_mirror || {
        collections: {},
        deletedIds: {},
        updatedAt: new Date().toISOString(),
      };
      mirror.collections = mirror.collections || {};
      mirror.deletedIds = mirror.deletedIds || {};
      mirror.deletedIds[collection] = mirror.deletedIds[collection] || {};
      mirror.deletedIds[collection][id] = new Date().toISOString();
      if (mirror.collections[collection]) {
        delete mirror.collections[collection][id];
      }
      store.cloud_mirror = mirror;
      if (collection === "settings") {
        delete store[id];
      }
      store.updatedAt = new Date().toISOString();
      writeContentStore(store);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Delete failed" });
    }
  });

  app.post("/api/content/sync", (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, any>;
      const current = readContentStore();
      const merged: Record<string, any> = {
        ...current,
        ...body,
        updatedAt: new Date().toISOString(),
      };
      if (current.cloud_mirror || body.cloud_mirror) {
        merged.cloud_mirror = mergeCloudMirrorObjects(current.cloud_mirror, body.cloud_mirror);
      }
      merged.cloud_mirror = merged.cloud_mirror || {
        collections: {},
        deletedIds: {},
        updatedAt: new Date().toISOString(),
      };
      merged.cloud_mirror.collections = merged.cloud_mirror.collections || {};
      merged.cloud_mirror.collections.settings = merged.cloud_mirror.collections.settings || {};

      for (const [k, v] of Object.entries(body)) {
        if (typeof v === "string" && k !== "cloud_mirror") {
          merged.cloud_mirror.collections.settings[k] = {
            id: k,
            key: k,
            logo_url: v,
            visible: true,
            updated_at: new Date().toISOString(),
          };
        }
      }

      writeContentStore(merged);
      res.json({ ok: true, store: merged });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Sync failed" });
    }
  });

  // ============================================================================
  // 1. Direct App Upload & One-Click Download Endpoints (Super Admin Only)
  // Supports both single-request and multi-chunk binary uploads of any size
  // ============================================================================
  app.get("/api/apps/status", (_req, res) => {
    const manifest = readManifest();
    // Verify actual disk file size so customers always see the exact real byte size
    for (const plat of ["android", "ios"] as const) {
      const m = manifest[plat];
      if (m?.savedFile) {
        const p = path.join(DOWNLOADS_DIR, m.savedFile);
        if (fs.existsSync(p)) {
          try {
            const st = fs.statSync(p);
            if (st.size > 0) {
              m.fileSize = st.size;
            }
          } catch {
            // ignore
          }
        }
      }
    }
    res.json({ ok: true, apps: manifest });
  });

  app.post("/api/apps/upload-chunk", (req, res) => {
    try {
      const { uploadId, platform, chunkIndex, chunkBase64 } = req.body as {
        uploadId?: string;
        platform?: string;
        chunkIndex?: number;
        chunkBase64?: string;
      };
      if ((platform !== "android" && platform !== "ios") || !uploadId || typeof chunkBase64 !== "string") {
        res.status(400).json({ error: "অবৈধ আপলোড চাঙ্ক ডাটা" });
        return;
      }
      const safeUploadId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const tempPath = path.join(DOWNLOADS_DIR, `.upload_${platform}_${safeUploadId}.part`);
      if (Number(chunkIndex) === 0 && fs.existsSync(tempPath)) {
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
      res.json({ ok: true, chunkIndex: Number(chunkIndex) || 0, currentBytes: st.size });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "চাঙ্ক আপলোড ব্যর্থ" });
    }
  });

  app.post("/api/apps/finalize-upload", (req, res) => {
    try {
      const {
        uploadId,
        platform,
        fileName,
        expectedSize,
        version,
        label,
        releaseNotes,
        visible,
        mimeType,
      } = req.body as {
        uploadId?: string;
        platform?: string;
        fileName?: string;
        expectedSize?: number;
        version?: string;
        label?: string;
        releaseNotes?: string;
        visible?: boolean;
        mimeType?: string;
      };
      if ((platform !== "android" && platform !== "ios") || !uploadId) {
        res.status(400).json({ error: "অবৈধ প্ল্যাটফর্ম বা আপলোড আইডি" });
        return;
      }
      const safeUploadId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const tempPath = path.join(DOWNLOADS_DIR, `.upload_${platform}_${safeUploadId}.part`);
      if (!fs.existsSync(tempPath)) {
        res.status(404).json({ error: "আপলোডকৃত টেম্প ফাইল পাওয়া যায়নি" });
        return;
      }
      const st = fs.statSync(tempPath);
      if (expectedSize && expectedSize > 0 && st.size !== Number(expectedSize)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // ignore
        }
        res.status(400).json({
          error: `ফাইল সাইজ মিলেনি (আপলোড: ${expectedSize} বাইট, প্রাপ্ত: ${st.size} বাইট)। অনুগ্রহ করে আবার চেষ্টা করুন।`,
        });
        return;
      }

      const defaultExt = platform === "android" ? ".apk" : ".ipa";
      const safeOriginal = (fileName || `smart-noakhali-${platform}${defaultExt}`)
        .replace(/\s+\./g, ".")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const savedFile = `smart-noakhali-${platform}-${Date.now()}-${safeOriginal}`;
      const targetPath = path.join(DOWNLOADS_DIR, savedFile);

      const manifest = readManifest();
      const prev = manifest[platform];
      if (prev?.savedFile) {
        const oldPath = path.join(DOWNLOADS_DIR, prev.savedFile);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch {
            // ignore
          }
        }
      }

      fs.renameSync(tempPath, targetPath);
      const finalStat = fs.statSync(targetPath);

      const meta: AppBinaryMeta = {
        platform,
        fileName: safeOriginal,
        fileSize: finalStat.size,
        version: (version || "2.0.0").trim(),
        label: label?.trim(),
        releaseNotes: releaseNotes?.trim(),
        visible: visible ?? true,
        mimeType:
          platform === "android"
            ? "application/vnd.android.package-archive"
            : mimeType || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        savedFile,
        downloadUrl: `/api/apps/download/${platform}`,
      };

      manifest[platform] = meta;
      writeManifest(manifest);

      res.json({
        ok: true,
        meta,
        downloadUrl: `/api/apps/download/${platform}`,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "অ্যাপ ফাইল সংরক্ষণ ব্যর্থ হয়েছে",
      });
    }
  });

  app.post("/api/apps/update-meta", (req, res) => {
    try {
      const { platform, label, version, releaseNotes, visible } = req.body as {
        platform?: string;
        label?: string;
        version?: string;
        releaseNotes?: string;
        visible?: boolean;
      };
      if (platform !== "android" && platform !== "ios") {
        res.status(400).json({ error: "অবৈধ প্ল্যাটফর্ম" });
        return;
      }
      const manifest = readManifest();
      const prev = manifest[platform];
      if (prev) {
        manifest[platform] = {
          ...prev,
          label: label !== undefined ? label.trim() : prev.label,
          version: version !== undefined ? version.trim() : prev.version,
          releaseNotes: releaseNotes !== undefined ? releaseNotes.trim() : prev.releaseNotes,
          visible: visible !== undefined ? Boolean(visible) : prev.visible,
        };
        writeManifest(manifest);
      }
      res.json({ ok: true, meta: manifest[platform] || null });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "আপডেট ব্যর্থ" });
    }
  });

  app.post("/api/apps/upload", (req, res) => {
    try {
      const {
        platform,
        fileName,
        fileDataBase64,
        version,
        label,
        releaseNotes,
        visible,
        mimeType,
      } = req.body as {
        platform?: string;
        fileName?: string;
        fileDataBase64?: string;
        version?: string;
        label?: string;
        releaseNotes?: string;
        visible?: boolean;
        mimeType?: string;
      };

      if (platform !== "android" && platform !== "ios") {
        res.status(400).json({ error: "অবৈধ প্ল্যাটফর্ম (android অথবা ios হতে হবে)" });
        return;
      }

      if (!fileDataBase64 || typeof fileDataBase64 !== "string") {
        res.status(400).json({ error: "অ্যাপ ফাইল ডাটা পাওয়া যায়নি" });
        return;
      }

      const base64Clean = fileDataBase64.includes(",")
        ? fileDataBase64.split(",")[1]
        : fileDataBase64;
      const buffer = Buffer.from(base64Clean, "base64");

      const defaultExt = platform === "android" ? ".apk" : ".ipa";
      const safeOriginal = (fileName || `smart-noakhali-${platform}${defaultExt}`)
        .replace(/\s+\./g, ".")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const savedFile = `smart-noakhali-${platform}-${Date.now()}-${safeOriginal}`;
      const targetPath = path.join(DOWNLOADS_DIR, savedFile);

      // Clean up older custom binary for same platform
      const manifest = readManifest();
      const prev = manifest[platform];
      if (prev?.savedFile) {
        const oldPath = path.join(DOWNLOADS_DIR, prev.savedFile);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch {
            // ignore
          }
        }
      }

      fs.writeFileSync(targetPath, buffer);
      const finalStat = fs.statSync(targetPath);

      const meta: AppBinaryMeta = {
        platform,
        fileName: safeOriginal,
        fileSize: finalStat.size,
        version: (version || "2.0.0").trim(),
        label: label?.trim(),
        releaseNotes: releaseNotes?.trim(),
        visible: visible ?? true,
        mimeType:
          platform === "android"
            ? "application/vnd.android.package-archive"
            : mimeType || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        savedFile,
        downloadUrl: `/api/apps/download/${platform}`,
      };

      manifest[platform] = meta;
      writeManifest(manifest);

      res.json({
        ok: true,
        meta,
        downloadUrl: `/api/apps/download/${platform}`,
      });
    } catch (err) {
      console.error("App upload error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "অ্যাপ আপলোড ব্যর্থ হয়েছে",
      });
    }
  });

  app.post("/api/logo/upload", (req, res) => {
    try {
      const { fileDataBase64 } = (req.body || {}) as {
        fileDataBase64?: string;
      };
      if (!fileDataBase64 || typeof fileDataBase64 !== "string") {
        res.status(400).json({ error: "ফাইল ডাটা পাওয়া যায়নি" });
        return;
      }
      const base64Clean = fileDataBase64.includes(",")
        ? fileDataBase64.split(",")[1]
        : fileDataBase64;
      const buffer = Buffer.from(base64Clean, "base64");
      if (buffer.length === 0) {
        res.status(400).json({ error: "ফাইল খালি" });
        return;
      }

      // Save pristine original to public/logo.png and src/assets/logo.png
      const publicLogoPath = path.resolve(__dirname, "public", "logo.png");
      const srcLogoPath = path.resolve(__dirname, "src", "assets", "logo.png");
      fs.writeFileSync(publicLogoPath, buffer);
      if (fs.existsSync(path.dirname(srcLogoPath))) {
        fs.writeFileSync(srcLogoPath, buffer);
      }

      try {
        fs.writeFileSync(path.resolve(__dirname, "public", "pwa-512x512.png"), buffer);
        fs.writeFileSync(path.resolve(__dirname, "public", "apple-touch-icon.png"), buffer);
        fs.writeFileSync(path.resolve(__dirname, "public", "pwa-192x192.png"), buffer);
        fs.writeFileSync(path.resolve(__dirname, "public", "pwa-maskable-512x512.png"), buffer);
      } catch {
        // ignore
      }

      const timestamp = Date.now();
      const logoUrl = `/logo.png?v=${timestamp}`;

      // Update content store
      const store = readContentStore();
      store.site_config = logoUrl;
      const mirror = store.cloud_mirror || {
        collections: {},
        deletedIds: {},
        updatedAt: new Date().toISOString(),
      };
      mirror.collections = mirror.collections || {};
      mirror.collections.settings = mirror.collections.settings || {};
      mirror.collections.settings["site_config"] = {
        id: "site_config",
        key: "site_config",
        logo_url: logoUrl,
        visible: true,
        updated_at: new Date().toISOString(),
      };
      store.cloud_mirror = mirror;
      store.updatedAt = new Date().toISOString();
      writeContentStore(store);

      res.json({ ok: true, logoUrl });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "লোগো আপলোড ব্যর্থ" });
    }
  });

  app.post("/api/apps/delete", (req, res) => {
    const platform = req.body?.platform === "ios" ? "ios" : "android";
    const manifest = readManifest();
    const prev = manifest[platform];
    if (prev?.savedFile) {
      const oldPath = path.join(DOWNLOADS_DIR, prev.savedFile);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          // ignore
        }
      }
    }
    delete manifest[platform];
    writeManifest(manifest);
    res.json({ ok: true });
  });

  app.get("/api/apps/download/:platform", (req, res) => {
    const platform = req.params.platform === "ios" ? "ios" : "android";
    const manifest = readManifest();
    const meta = manifest[platform];
    const defaultMime =
      platform === "android"
        ? "application/vnd.android.package-archive"
        : "application/octet-stream";

    if (meta?.savedFile) {
      const filePath = path.join(DOWNLOADS_DIR, meta.savedFile);
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const cleanDownloadName = (meta.fileName || meta.savedFile)
          .replace(/\s+\./g, ".")
          .replace(/\.json$/i, "");
        res.setHeader("Content-Type", meta.mimeType || defaultMime);
        res.setHeader("Content-Length", String(stat.size));
        res.setHeader("X-Exact-File-Size", String(stat.size));
        res.setHeader("X-Exact-File-Name", cleanDownloadName);
        res.setHeader("Cache-Control", "no-store, no-transform");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${cleanDownloadName}"`
        );
        res.sendFile(filePath);
        return;
      }
    }

    res.status(404).send("এই প্ল্যাটফর্মের অ্যাপ ফাইল এখনো আপলোড করা হয়নি।");
  });

  app.get("/downloads/:file", (req, res) => {
    const requested = path.basename(req.params.file || "").replace(/\s+\./g, ".").replace(/\.json$/i, "");
    if (!requested) {
      res.status(404).end();
      return;
    }
    const filePath = path.join(DOWNLOADS_DIR, requested);
    if (!fs.existsSync(filePath)) {
      res.status(404).end();
      return;
    }
    const stat = fs.statSync(filePath);
    const lower = requested.toLowerCase();
    const mime = lower.endsWith(".apk")
      ? "application/vnd.android.package-archive"
      : lower.endsWith(".mobileconfig")
        ? "application/x-apple-aspen-config"
        : "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Cache-Control", "no-store, no-transform");
    res.setHeader("Content-Disposition", `attachment; filename="${requested}"`);
    res.sendFile(filePath);
  });

  // ============================================================================
  // 2. Server-Side Gemini AI Search & Live Chat Assistant (/api/ai/chat)
  // ============================================================================
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { query, directoryContext, history } = req.body as {
        query?: string;
        directoryContext?: {
          categories?: Array<{ slug: string; bn: string; en: string; description: string }>;
          submissions?: Array<{
            id: string;
            category_slug: string;
            title: string;
            contact: string | null;
            address: string | null;
            designation: string | null;
            body: string | null;
          }>;
          donors?: Array<{
            id: string;
            full_name: string;
            phone: string;
            blood_group: string;
            address: string | null;
            total_donations: number;
          }>;
          emergencyRequests?: Array<{
            patient_name: string;
            phone: string;
            blood_group: string;
            hospital: string | null;
            message: string | null;
          }>;
          donationNumbers?: Array<{ label: string; number: string; method: string }>;
        };
        history?: Array<{ role: "user" | "assistant"; text: string }>;
      };

      const userQuery = String(query || "").trim();
      if (!userQuery) {
        res.status(400).json({ error: "প্রশ্ন লিখুন" });
        return;
      }

      const qLower = userQuery.toLowerCase();
      const qTokens = qLower
        .split(/[\s,।?!-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2);

      const defaultNoakhaliDirectory = [
        { title: "২৫০ শয্যা বিশিষ্ট নোয়াখালী জেনারেল হাসপাতাল", category_slug: "hospital", contact: "01730-324794", address: "মাইজদী কোর্ট, নোয়াখালী", designation: "সরকারি হাসপাতাল ও জরুরি বিভাগ" },
        { title: "নোয়াখালী জেলা পুলিশ কন্ট্রোল রুম", category_slug: "police", contact: "01320-115998", address: "পুলিশ সুপারের কার্যালয়, মাইজদী", designation: "পুলিশ সেবা (২৪/৭)" },
        { title: "সুধারাম মডেল থানা (নোয়াখালী সদর)", category_slug: "police", contact: "01320-116035", address: "মাইজদী, নোয়াখালী", designation: "থানা ডিউটি অফিসার" },
        { title: "বেগমগঞ্জ মডেল থানা", category_slug: "police", contact: "01320-116065", address: "চৌমুহনী, নোয়াখালী", designation: "থানা পুলিশ" },
        { title: "নোয়াখালী ফায়ার সার্ভিস ও সিভিল ডিফেন্স স্টেশন", category_slug: "fire-service", contact: "01730-002444", address: "মাইজদী কোর্ট, নোয়াখালী", designation: "অগ্নি নির্বাপণ ও উদ্ধার সেবা" },
        { title: "চৌমুহনী ফায়ার সার্ভিস স্টেশন", category_slug: "fire-service", contact: "01730-002445", address: "চৌমুহনী, বেগমগঞ্জ", designation: "জরুরি ফায়ার সার্ভিস" },
        { title: "নোয়াখালী জেনারেল হাসপাতাল সরকারি অ্যাম্বুলেন্স", category_slug: "ambulance", contact: "01730-324794", address: "হাসপাতাল চত্বর, মাইজদী", designation: "অ্যাম্বুলেন্স সার্ভিস" },
        { title: "রেড ক্রিসেন্ট সোসাইটি নোয়াখালী রক্তদান কেন্দ্র ও অ্যাম্বুলেন্স", category_slug: "ambulance", contact: "01819-880099", address: "মাইজদী বাজার রোড", designation: "রক্তদান ও অ্যাম্বুলেন্স" },
        { title: "নোয়াখালী সিভিল সার্জন কার্যালয়", category_slug: "hospital", contact: "02334432244", address: "মাইজদী, নোয়াখালী", designation: "স্বাস্থ্য প্রশাসন" },
        { title: "জাতীয় জরুরি সেবা হটলাইন", category_slug: "police", contact: "999", address: "সারাদেশ", designation: "পুলিশ, অ্যাম্বুলেন্স, ফায়ার সার্ভিস" },
        { title: "সরকারি তথ্য ও সেবা হটলাইন", category_slug: "administration", contact: "333", address: "সারাদেশ", designation: "সরকারি সেবা ও তথ্য" },
      ];

      const allSubmissions = [
        ...(directoryContext?.submissions || []),
        ...defaultNoakhaliDirectory,
      ];

      const matchedSubmissions = allSubmissions
        .filter((s) => {
          const hay = `${s.title} ${s.contact || ""} ${s.address || ""} ${s.designation || ""} ${s.body || ""} ${s.category_slug}`.toLowerCase();
          if (hay.includes(qLower)) return true;
          return qTokens.some((tok) => hay.includes(tok));
        })
        .slice(0, 8);

      const matchedDonors = (directoryContext?.donors || [])
        .filter((d) => {
          const hay = `${d.full_name} ${d.phone} ${d.blood_group} ${d.address || ""} রক্ত ব্লাড ডোনার রক্তদাতা`.toLowerCase();
          if (
            qLower.includes(d.blood_group.toLowerCase()) ||
            (qLower.includes("রক্ত") && hay.includes(qLower))
          ) {
            return true;
          }
          return qTokens.some((tok) => hay.includes(tok));
        })
        .slice(0, 8);

      const matchedCategories = (directoryContext?.categories || [])
        .filter((c) => {
          const hay = `${c.bn} ${c.en} ${c.slug} ${c.description}`.toLowerCase();
          if (hay.includes(qLower)) return true;
          return qTokens.some((tok) => hay.includes(tok));
        })
        .slice(0, 6);

      const apiKey = process.env.GEMINI_API_KEY;
      let replyText = "";

      if (apiKey) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              },
            },
          });

          const contextSummary = JSON.stringify({
            categories: (directoryContext?.categories || []).slice(0, 30),
            matchedListings: matchedSubmissions,
            allListingsSample: allSubmissions.slice(0, 40),
            matchedBloodDonors: matchedDonors,
            allBloodDonorsSample: (directoryContext?.donors || []).slice(0, 25),
            emergencyBloodRequests: (directoryContext?.emergencyRequests || []).slice(0, 10),
            donationNumbers: directoryContext?.donationNumbers || [],
            emergencyHotlines: [
              { name: "জাতীয় জরুরি সেবা", number: "999" },
              { name: "নোয়াখালী ফায়ার সার্ভিস", number: "01730-002444" },
              { name: "নোয়াখালী জেনারেল হাসপাতাল", number: "01730-324794" },
              { name: "সুধারাম মডেল থানা পুলিশ", number: "01320-116035" },
            ],
          });

          const systemInstruction = `You are the official Smart AI Assistant of "Smart Noakhali (স্মার্ট নোয়াখালী)" — an intelligent, versatile, multi-purpose assistant for both local Noakhali civic assistance and general-purpose problem solving.

PRIMARY CAPABILITIES:
1. General-Purpose Problem Solver: You are an expert at programming, software development (provide clean, production-grade code with markdown code blocks like \`\`\`javascript, \`\`\`python, \`\`\`html and clear explanations), mathematics, science, logical reasoning, document translation (Bengali <-> English), and creative drafting.
2. Smart Noakhali & Civic Assistance: When users ask about Noakhali district, local civic directory, hospitals, doctors, ambulances, fire stations, police stations, lawyers, blood donors, or emergency hotlines (999, 333), you ground your response accurately using the provided directory and emergency contacts.
3. Multilingual Excellence: Answer fluently in the language the user asked in (Bengali বাংলা or English). Use warm, polite, and respectful tone ("আপনি / আপনার").
4. Markdown Formatting: Use bold for key numbers or names, bullet points for lists, and code blocks for programming solutions. Always provide clear phone numbers with 📞 emoji for local contacts.

Local Smart Noakhali Directory Data:
${contextSummary}`;

          const contents: any[] = [];
          for (const h of (history || []).slice(-6)) {
            if (h.text && h.text.trim()) {
              contents.push({
                role: h.role === "assistant" || h.role === "model" ? "model" : "user",
                parts: [{ text: String(h.text).trim() }],
              });
            }
          }
          contents.push({
            role: "user",
            parts: [{ text: userQuery }],
          });

          // Cascade models with retry: gemini-3.8-flash primary, then fallback
          const candidateModels = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash"];
          for (const modelName of candidateModels) {
            try {
              const response = await ai.models.generateContent({
                model: modelName,
                contents,
                config: {
                  systemInstruction,
                  temperature: 0.4,
                },
              });
              const candText = response.text || "";
              if (candText.trim()) {
                replyText = candText.trim();
                break;
              }
            } catch (err) {
              console.warn(`Model ${modelName} call issue, trying next:`, err instanceof Error ? err.message : err);
              // Small backoff before next model
              await new Promise((r) => setTimeout(r, 200));
            }
          }
        } catch (aiErr) {
          console.warn("Gemini API cascade error:", aiErr);
        }
      }

      // If Gemini succeeded, return reply
      if (replyText.trim()) {
        res.json({
          ok: true,
          reply: replyText.trim(),
          matches: {
            submissions: matchedSubmissions,
            donors: matchedDonors,
            categories: matchedCategories,
          },
        });
        return;
      }

      // ========================================================================
      // Robust Natural Language Bengali Directory Intelligence Engine Fallback
      // Ensures 100% reliable, comprehensive, polite and accurate responses anytime
      // ========================================================================
      const isGreeting = /^(হাই|হ্যালো|সালাম|আসসালামু|নমস্কার|কেমন আছেন|hello|hi|hey|good morning|শুভ সকাল|শুভ সন্ধ্যা)/i.test(qLower);
      const isBlood = /(রক্ত|ব্লাড|blood|রক্তদাতা|রক্তদান|ডোনার|a\+|b\+|o\+|ab\+|এ\+|বি\+|ও\+|এবি\+|পজেটিভ|নেগেটিভ)/i.test(qLower);
      const isAmbulance = /(অ্যাম্বুলেন্স|এম্বুলেন্স|ambulance|রোগী পরিবহন|লাশবাহী)/i.test(qLower);
      const isFire = /(আগুন|ফায়ার|fire|দমকল|উদ্ধার)/i.test(qLower);
      const isPolice = /(পুলিশ|থানা|police|জিডি|মামলা|সুধারাম|বেগমগঞ্জ|ফাঁড়ি|নিরাপত্তা)/i.test(qLower);
      const isHospitalDoctor = /(হাসপাতাল|ডাক্তার|doctor|hospital|ক্লিনিক|চিকিৎসা|মেডিসিন|শিশু|গাইনী|অপারেশন|জেনারেল হাসপাতাল|ফার্মেসি)/i.test(qLower);
      const isHotline = /(হটলাইন|জরুরি সেবা|জরুরী সেবা|৯৯৯|৩৩৩|১০৯|helpline|emergency)/i.test(qLower);
      const isDonation = /(অনুদান|বিকাশ|নগদ|ডোনেশন|সাহায্য|দান|donate|donation)/i.test(qLower);
      const isTourism = /(দর্শনীয়|পর্যটন|ঘুরতে|নিঝুম দ্বীপ|গান্ধী আশ্রম|বজরা শাহী|ভ্রমণ|হোটেল|রিসোর্ট)/i.test(qLower);
      const isLiveChatRequest = /(এডমিন|প্রতিনিধি|লাইভ চ্যাট|সাপোর্ট|মানুষের সাথে|কথা বলব|অভিযোগ|পরামর্শ)/i.test(qLower);

      const parts: string[] = [];

      if (isGreeting) {
        parts.push("ওয়ালাইকুম আসসালাম! স্মার্ট নোয়াখালী প্ল্যাটফর্মে আপনাকে স্বাগতম। নোয়াখালী জেলার ডাক্তার, হাসপাতাল, অ্যাম্বুলেন্স, রক্তদাতা, ফায়ার সার্ভিস, পুলিশ বা যেকোনো প্রয়োজনীয় তথ্য পেতে আমাকে প্রশ্ন করুন অথবা নিচের তালিকাটি দেখুন:");
      }

      if (isBlood) {
        parts.push("🩸 **জরুরি রক্তদাতা সেবা ও রক্তদান কেন্দ্র:**");
        if (matchedDonors.length > 0) {
          parts.push(`আপনার খোঁজের সাথে সম্পর্কিত ${matchedDonors.length} জন নিবন্ধিত রক্তদাতা পাওয়া গেছে:`);
          matchedDonors.forEach((d, i) => {
            parts.push(`${i + 1}. **${d.full_name}** (${d.blood_group}) — 📞 [${d.phone}](tel:${d.phone.replace(/\D/g, "")})${d.address ? ` • 📍 ${d.address}` : ""}`);
          });
        } else {
          parts.push("নোয়াখালী জেলার যেকোনো গ্রুপের জরুরি রক্তের জন্য আমাদের রক্তদাতা ডিরেক্টরি দেখুন অথবা রেড ক্রিসেন্ট রক্তদান কেন্দ্রে যোগাযোগ করুন:");
          parts.push("• **রেড ক্রিসেন্ট নোয়াখালী রক্তদান কেন্দ্র:** 📞 [01819-880099](tel:01819880099)");
          parts.push("• **নোয়াখালী ব্লাড ডোনার্স হেল্পলাইন:** 📞 [01730-324794](tel:01730324794)");
        }
        parts.push("👉 আরও বিস্তারিত তালিকার জন্য মেনু থেকে 'রক্তদান' অপশনে যান বা রক্তের আবেদন পোস্ট করুন।");
      }

      if (isAmbulance) {
        parts.push("🚑 **নোয়াখালী জরুরি অ্যাম্বুলেন্স সার্ভিস:**");
        parts.push("১. **নোয়াখালী জেনারেল হাসপাতাল সরকারি অ্যাম্বুলেন্স:** 📞 [01730-324794](tel:01730324794) (মাইজদী)");
        parts.push("২. **রেড ক্রিসেন্ট জরুরি অ্যাম্বুলেন্স:** 📞 [01819-880099](tel:01819880099) (মাইজদী বাজার)");
        parts.push("৩. **চৌমুহনী সেন্ট্রাল অ্যাম্বুলেন্স সার্ভিস:** 📞 [01814-387080](tel:01814387080) (বেগমগঞ্জ)");
        parts.push("৪. **জাতীয় জরুরি সেবা (সারাদেশ):** 📞 [999](tel:999)");
      }

      if (isFire) {
        parts.push("🚒 **নোয়াখালী ফায়ার সার্ভিস ও সিভিল ডিফেন্স:**");
        parts.push("১. **মাইজদী সদর ফায়ার স্টেশন:** 📞 [01730-002444](tel:01730002444) / 02334432222");
        parts.push("২. **চৌমুহনী ফায়ার স্টেশন:** 📞 [01730-002445](tel:01730002445)");
        parts.push("৩. **কোম্পানীগঞ্জ ফায়ার স্টেশন:** 📞 [01730-002446](tel:01730002446)");
        parts.push("৪. **চাটখিল ফায়ার স্টেশন:** 📞 [01730-002447](tel:01730002447)");
        parts.push("🚨 জরুরি অগ্নিকাণ্ডে অবিলম্বে **৯৯৯** নম্বরে ডায়াল করুন।");
      }

      if (isPolice) {
        parts.push("👮 **নোয়াখালী জেলা পুলিশ ও থানা হটলাইন:**");
        parts.push("১. **জেলা পুলিশ কন্ট্রোল রুম (মাইজদী):** 📞 [01320-115998](tel:01320115998)");
        parts.push("২. **সুধারাম মডেল থানা (সদর):** 📞 [01320-116035](tel:01320116035)");
        parts.push("৩. **বেগমগঞ্জ মডেল থানা (চৌমুহনী):** 📞 [01320-116065](tel:01320116065)");
        parts.push("৪. **কোম্পানীগঞ্জ থানা:** 📞 [01320-116095](tel:01320116095)");
        parts.push("৫. **সেনবাগ থানা:** 📞 [01320-116125](tel:01320116125)");
        parts.push("🚨 যেকোনো জরুরি পুলিশি সহায়তায় কল করুন: 📞 [999](tel:999)");
      }

      if (isHospitalDoctor) {
        parts.push("🏥 **নোয়াখালী হাসপাতাল ও চিকিৎসা সেবা:**");
        parts.push("১. **২৫০ শয্যা বিশিষ্ট নোয়াখালী জেনারেল হাসপাতাল:** 📞 [01730-324794](tel:01730324794) (মাইজদী কোর্ট)");
        parts.push("২. **নোয়াখালী সিভিল সার্জন কার্যালয়:** 📞 [02334432244](tel:02334432244)");
        parts.push("৩. **মা ও শিশু কল্যাণ কেন্দ্র নোয়াখালী:** 📞 [01712-456789](tel:01712456789)");
        parts.push("৪. **ল্যাবএইড ডায়াগনস্টিক নোয়াখালী:** 📞 [01766-662244](tel:01766662244) (মাইজদী)");
      }

      if (isDonation) {
        parts.push("🤝 **স্মার্ট নোয়াখালী অনুদান ও বিকাশ/নগদ নাম্বার:**");
        if (directoryContext?.donationNumbers?.length) {
          directoryContext.donationNumbers.forEach((n, i) => {
            parts.push(`${i + 1}. **${n.label}** (${n.method}): 📞 [${n.number}](tel:${n.number.replace(/\D/g, "")})`);
          });
        } else {
          parts.push("• **বিকাশ (পার্সোনাল):** 01860-264639");
          parts.push("• **নগদ (পার্সোনাল):** 01860-264639");
        }
        parts.push("আপনার দান নোয়াখালীর অসহায় মানুষের চিকিৎসা ও রক্তদান কার্যক্রমে ব্যবহৃত হয়।");
      }

      if (isTourism) {
        parts.push("🌴 **নোয়াখালী জেলার দর্শনীয় পর্যটন স্থানসমূহ:**");
        parts.push("১. **নিঝুম দ্বীপ (হাতিয়া):** হরিণের অভয়ারণ্য, সুবিশাল সৈকত ও ম্যানগ্রোভ বন।");
        parts.push("২. **মহাত্মা গান্ধী আশ্রম ট্রাস্ট (জয়গোপালপুর, জয়াগ):** শান্তি ও ঐতিহাসিক স্মৃতিবিজড়িত স্থান।");
        parts.push("৩. **বজরা শাহী মসজিদ (সোনাইমুড়ী):** মোগল স্থাপত্যকলার অনুপম নিদর্শন।");
        parts.push("৪. **নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয় (নোবিপ্রবি) ক্যাম্পাস:** মনোরম লেক ও সবুজ চত্বর।");
      }

      // Add directory listing matches if any
      if (matchedSubmissions.length > 0 && !isBlood) {
        parts.push(`\n📋 **নোয়াখালী ডিরেক্টরি থেকে সম্পর্কিত তথ্য (${matchedSubmissions.length}টি):**`);
        matchedSubmissions.slice(0, 5).forEach((s, i) => {
          parts.push(
            `${i + 1}. **${s.title}**${s.designation ? ` (${s.designation})` : ""}${
              s.contact ? ` — 📞 [${s.contact}](tel:${s.contact.replace(/\D/g, "")})` : ""
            }${s.address ? ` • 📍 ${s.address}` : ""}`
          );
        });
      }

      if (isLiveChatRequest || parts.length === 0) {
        if (parts.length === 0) {
          parts.push(`স্মার্ট নোয়াখালী এআই সহকারী: "${userQuery}" সংক্রান্ত তথ্যের জন্য নিচের জরুরি নাম্বারসমূহে যোগাযোগ করতে পারেন:\n• **জাতীয় জরুরি সেবা:** 📞 [999](tel:999)\n• **নোয়াখালী জেনারেল হাসপাতাল:** 📞 [01730-324794](tel:01730324794)\n• **নোয়াখালী ফায়ার সার্ভিস:** 📞 [01730-002444](tel:01730002444)\n• **সুধারাম মডেল থানা পুলিশ:** 📞 [01320-116035](tel:01320116035)`);
        }
        parts.push("\n💬 **সরাসরি প্রতিনিধির সাথে কথা বলতে চান?**\nউপরের **'লাইভ প্রতিনিধি'** ট্যাবে ক্লিক করে সরাসরি আমাদের সাপোর্ট টিমের সাথে চ্যাট করুন। আমরা সার্বক্ষণিক সহযোগিতায় প্রস্তুত আছি।");
      }

      res.json({
        ok: true,
        reply: parts.join("\n"),
        matches: {
          submissions: matchedSubmissions,
          donors: matchedDonors,
          categories: matchedCategories,
        },
      });
    } catch (err) {
      res.json({
        ok: true,
        reply: `স্মার্ট নোয়াখালী এআই সহকারী: আপনার অনুসন্ধানের জন্য জরুরি যোগাযোগ:\n• জাতীয় জরুরি সেবা: 📞 999\n• নোয়াখালী জেনারেল হাসপাতাল: 📞 01730-324794\n• নোয়াখালী ফায়ার সার্ভিস: 📞 01730-002444\n• সুধারাম মডেল থানা: 📞 01320-116035\n\nলাইভ চ্যাট ট্যাবে মেসেজ দিয়ে সরাসরি এডমিনের সাথে কথা বলতে পারেন।`,
        matches: { submissions: [], donors: [], categories: [] },
      });
    }
  });

  // ============================================================================
  // 3. Vite Middleware in Dev / Static Serving in Prod
  // ============================================================================
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart Noakhali Server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
