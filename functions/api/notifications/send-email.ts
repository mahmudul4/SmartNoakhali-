interface Env {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}) => {
  try {
    const { request, env } = context;
    const body = (await request.json().catch(() => ({}))) as {
      to?: string;
      subject?: string;
      text?: string;
      html?: string;
      category?: string;
      priority?: string;
    };

    const cleanTo = String(body.to || "").trim();
    const cleanSubject = String(body.subject || "").trim() || "স্মার্ট নোয়াখালী বিজ্ঞপ্তি";
    const cleanText = String(body.text || "").trim();

    if (!cleanTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTo)) {
      return new Response(
        JSON.stringify({
          ok: false,
          delivered: false,
          reason: "সঠিক প্রাপক ইমেইল ঠিকানা দেওয়া হয়নি।",
        }),
        { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    if (!cleanText && !body.html) {
      return new Response(
        JSON.stringify({
          ok: false,
          delivered: false,
          reason: "ইমেইলের বার্তা খালি।",
        }),
        { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    if (!env.RESEND_API_KEY) {
      return new Response(
        JSON.stringify({
          ok: false,
          delivered: false,
          configured: false,
          reason:
            "Cloudflare Pages এনভায়রনমেন্টে RESEND_API_KEY কনফিগার করা নেই।",
        }),
        { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const safeHtml =
      body.html ||
      `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
        <div style="font-size: 12px; font-weight: bold; color: #047857; margin-bottom: 6px;">${body.category || "স্মার্ট নোয়াখালী"}${body.priority === "urgent" ? " • জরুরি" : ""}</div>
        <h2 style="color: #064e3b; margin: 0 0 12px 0;">${cleanSubject}</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-line;">${cleanText}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 11px;">স্মার্ট নোয়াখালী — <a href="https://smartnoakhali.com">smartnoakhali.com</a></p>
      </div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL || "Smart Noakhali <onboarding@resend.dev>",
        to: [cleanTo],
        subject: cleanSubject,
        text: cleanText,
        html: safeHtml,
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return new Response(
        JSON.stringify({
          ok: false,
          delivered: false,
          configured: true,
          reason: `Resend API ত্রুটি (${r.status}): ${errText.slice(0, 180)}`,
        }),
        { status: 502, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, delivered: true, provider: "resend", to: cleanTo }),
      { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        delivered: false,
        reason: err?.message || "ইমেইল পাঠাতে ব্যর্থ হয়েছে",
      }),
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }
};
