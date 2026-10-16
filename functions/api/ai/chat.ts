interface Env {
  GEMINI_API_KEY?: string;
}

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}) => {
  try {
    const { request, env } = context;
    const apiKey = env.GEMINI_API_KEY;
    const body = (await request.json().catch(() => ({}))) as any;
    const userQuery = String(body.query || "").trim();

    if (!userQuery) {
      return new Response(JSON.stringify({ error: "প্রশ্ন লিখুন" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          text: "স্মার্ট নোয়াখালী এআই সহকারী: আপনার অনুসন্ধানের জন্য ধন্যবাদ। নোয়াখালীর যেকোনো সরকারি ও জরুরি সেবার জন্য আমাদের ৩৩৩ ও ৯৯৯ হটলাইন ব্যবহার করতে পারেন। (Cloudflare Pages সেটিংসে GEMINI_API_KEY যোগ করলে এআই লাইভ চ্যাট সম্পূর্ণ সক্রিয় হবে।)",
          sources: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `তুমি "স্মার্ট নোয়াখালী (Smart Noakhali)" অ্যাপের অফিশিয়াল স্মার্ট এআই সহকারী।
তোমার কাজ নোয়াখালী জেলার নাগরিকদের জরুরি সেবা (যেমন: ডাক্তার, হাসপাতাল, অ্যাম্বুলেন্স, ফায়ার সার্ভিস, থানা পুলিশ, রক্তদাতা, অনুদান) আন্তরিকভাবে এবং শুদ্ধ বাংলায় বুঝিয়ে দেওয়া।

ব্যবহারকারীর প্রশ্ন: ${userQuery}`;

    const resp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }],
          },
        ],
      }),
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          text: "দুঃখিত, এই মুহূর্তে এআই সার্ভিসের সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা ৩৩৩/৯৯৯ নাম্বারে যোগাযোগ করুন।",
          sources: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    const data: any = await resp.json();
    const generatedText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "তথ্য পাওয়া যায়নি।";

    return new Response(
      JSON.stringify({
        text: generatedText,
        sources: [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
};
