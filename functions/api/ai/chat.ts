import { GoogleGenAI } from "@google/genai";

interface Env {
  GEMINI_API_KEY?: string;
}

const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

function expandNoakhaliTransliteration(rawQuery: string): string {
  const lower = rawQuery.toLowerCase();
  const synonyms: Array<[RegExp, string]> = [
    [/\b(noyakhali|noakhali|noakhaly|nowakhali)\b/g, "নোয়াখালী নোয়াখালী"],
    [/\b(haspatal|hospital|hosp|clinic)\b/g, "হাসপাতাল ক্লিনিক জেনারেল হাসপাতাল"],
    [/\b(daktar|doctor|dr|chikitsha)\b/g, "ডাক্তার চিকিৎসা মেডিসিন"],
    [/\b(roktodata|rokto|blood|donor|blod)\b/g, "রক্তদাতা রক্ত ব্লাড ডোনার"],
    [/\b(ambulance|embulance)\b/g, "অ্যাম্বুলেন্স রোগী পরিবহন"],
    [/\b(police|pulish|thana|gd)\b/g, "পুলিশ থানা সুধারাম জিডি"],
    [/\b(fire|agun|domkol)\b/g, "ফায়ার সার্ভিস দমকল আগুন"],
    [/\b(maijdee|maijdi|sadar)\b/g, "মাইজদী সদর"],
    [/\b(chowmuhani|chaumuhani|choumuhani|begumganj)\b/g, "চৌমুহনী বেগমগঞ্জ"],
    [/\b(senbag|senbagh)\b/g, "সেনবাগ"],
    [/\b(hatiya|hatia|nijhum)\b/g, "হাতিয়া নিঝুম দ্বীপ"],
    [/\b(sonaimuri|sonaimury)\b/g, "সোনাইমুড়ী"],
    [/\b(chatkhil)\b/g, "চাটখিল"],
    [/\b(companiganj|basurhat)\b/g, "কোম্পানীগঞ্জ বসুরহাট"],
    [/\b(subarnachar|charjabbar)\b/g, "সুবর্ণচর"],
    [/\b(kabirhat)\b/g, "কবিরহাট"],
    [/\b(bkash|bikash|nagad|nogod|rocket|donate|donation|onudan)\b/g, "অনুদান বিকাশ নগদ ডোনেশন"],
    [/\b(train|bus|gari|ticket)\b/g, "ট্রেন বাস পরিবহন"],
  ];
  let expanded = lower;
  for (const [pattern, replacement] of synonyms) {
    if (pattern.test(expanded)) {
      expanded += ` ${replacement}`;
    }
  }
  return expanded;
}

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}) => {
  try {
    const { request, env } = context;
    const clientIp =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
      "edge";
    const now = Date.now();
    const rate = rateLimitCache.get(clientIp);
    if (rate && rate.resetAt > now) {
      if (rate.count >= 30) {
        return new Response(
          JSON.stringify({
            error: "অল্প সময়ে অনেক বেশি প্রশ্ন পাঠানো হয়েছে। অনুগ্রহ করে ১ মিনিট পর আবার চেষ্টা করুন।",
            suggestHandoff: true,
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }
        );
      }
      rate.count += 1;
    } else {
      rateLimitCache.set(clientIp, { count: 1, resetAt: now + 60_000 });
    }

    const apiKey = env.GEMINI_API_KEY;
    const body = (await request.json().catch(() => ({}))) as {
      query?: string;
      history?: Array<{ role: "user" | "assistant" | "model"; text: string }>;
      aiConfig?: {
        botName?: string;
        systemInstructions?: string;
        tone?: "helpful_bn" | "concise_bn" | "bilingual";
        faqs?: Array<{
          question: string;
          answer: string;
          keywords?: string;
          visible?: boolean;
        }>;
      };
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
    };

    const userQuery = String(body.query || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const directoryContext = body.directoryContext || {};
    const aiConfig = body.aiConfig;

    if (!userQuery) {
      return new Response(JSON.stringify({ error: "প্রশ্ন লিখুন" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    if (userQuery.length > 1200) {
      return new Response(JSON.stringify({ error: "প্রশ্নটি অত্যন্ত বড় (সর্বোচ্চ ১২০০ অক্ষর)" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const expandedQuery = expandNoakhaliTransliteration(userQuery);
    const qTokens = expandedQuery
      .split(/[\s,।?!-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);

    const defaultNoakhaliDirectory = [
      { id: "hosp_general_noakhali", title: "২৫০ শয্যা বিশিষ্ট নোয়াখালী জেনারেল হাসপাতাল", category_slug: "hospital", contact: "01730-324794", address: "মাইজদী কোর্ট, নোয়াখালী", designation: "সরকারি হাসপাতাল ও জরুরি বিভাগ" },
      { id: "police_control_noakhali", title: "নোয়াখালী জেলা পুলিশ কন্ট্রোল রুম", category_slug: "police", contact: "01320-115998", address: "পুলিশ সুপারের কার্যালয়, মাইজদী", designation: "পুলিশ সেবা (২৪/৭)" },
      { id: "police_sudharam", title: "সুধারাম মডেল থানা (নোয়াখালী সদর)", category_slug: "police", contact: "01320-116035", address: "মাইজদী, নোয়াখালী", designation: "থানা ডিউটি অফিসার" },
      { id: "police_begumganj", title: "বেগমগঞ্জ মডেল থানা", category_slug: "police", contact: "01320-116065", address: "চৌমুহনী, নোয়াখালী", designation: "থানা পুলিশ" },
      { id: "fire_maijdee", title: "নোয়াখালী ফায়ার সার্ভিস ও সিভিল ডিফেন্স স্টেশন", category_slug: "fire-service", contact: "01730-002444", address: "মাইজদী কোর্ট, নোয়াখালী", designation: "অগ্নি নির্বাপণ ও উদ্ধার সেবা" },
      { id: "fire_chowmuhani", title: "চৌমুহনী ফায়ার সার্ভিস স্টেশন", category_slug: "fire-service", contact: "01730-002445", address: "চৌমুহনী, বেগমগঞ্জ", designation: "জরুরি ফায়ার সার্ভিস" },
      { id: "amb_red_crescent", title: "রেড ক্রিসেন্ট নোয়াখালী রক্তদান কেন্দ্র ও অ্যাম্বুলেন্স", category_slug: "ambulance", contact: "01819-880099", address: "মাইজদী বাজার রোড", designation: "রক্তদান ও অ্যাম্বুলেন্স" },
      { id: "hotline_999", title: "জাতীয় জরুরি সেবা হটলাইন", category_slug: "police", contact: "999", address: "সারাদেশ (২৪ ঘণ্টা ফ্রি)", designation: "পুলিশ, অ্যাম্বুলেন্স, ফায়ার সার্ভিস" },
      { id: "hotline_333", title: "সরকারি তথ্য ও সেবা হটলাইন", category_slug: "administration", contact: "333", address: "সারাদেশ (২৪ ঘণ্টা ফ্রি)", designation: "সরকারি সেবা ও তথ্য" },
    ];

    const allSubmissions = [
      ...(directoryContext.submissions || []),
      ...defaultNoakhaliDirectory,
    ];

    const matchedSubmissions = allSubmissions
      .filter((s) => {
        const hay = `${s.title} ${s.contact || ""} ${s.address || ""} ${s.designation || ""} ${s.category_slug}`.toLowerCase();
        if (expandedQuery.includes(s.title.toLowerCase())) return true;
        return qTokens.some((tok) => hay.includes(tok));
      })
      .slice(0, 8);

    const matchedDonors = (directoryContext.donors || [])
      .filter((d) => {
        const hay = `${d.full_name} ${d.phone} ${d.blood_group} ${d.address || ""} রক্ত ব্লাড ডোনার রক্তদাতা`.toLowerCase();
        if (expandedQuery.includes(d.blood_group.toLowerCase())) return true;
        return qTokens.some((tok) => hay.includes(tok));
      })
      .slice(0, 8);

    const matchedCategories = (directoryContext.categories || [])
      .filter((c) => {
        const hay = `${c.bn} ${c.en} ${c.slug} ${c.description}`.toLowerCase();
        return qTokens.some((tok) => hay.includes(tok));
      })
      .slice(0, 6);

    const matchedFaqs = (aiConfig?.faqs || [])
      .filter((f) => f && f.visible !== false)
      .filter((f) => {
        const hay = `${f.question} ${f.answer} ${f.keywords || ""}`.toLowerCase();
        return qTokens.some((tok) => hay.includes(tok));
      })
      .slice(0, 5);

    let generatedText = "";
    let aiErrorMsg: string | null = null;
    let upstreamStatus = 502;

    if (!apiKey) {
      aiErrorMsg = "GEMINI_API_KEY কনফিগার করা নেই";
      upstreamStatus = 503;
    } else {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const botName = (aiConfig?.botName || "Smart Noakhali AI").trim();
        const toneGuide =
          aiConfig?.tone === "concise_bn"
            ? "Answer concisely in natural Bengali."
            : aiConfig?.tone === "bilingual"
              ? "Answer in Bengali or English matching the user's question."
              : "Answer warmly, politely, and accurately in natural Bengali ('আপনি / আপনার').";

        const contextSummary = JSON.stringify({
          adminFaqs: matchedFaqs.length > 0 ? matchedFaqs : (aiConfig?.faqs || []).slice(0, 8),
          categories: (directoryContext.categories || []).slice(0, 40),
          matchedListings: matchedSubmissions,
          allListingsSample: allSubmissions.slice(0, 35),
          matchedBloodDonors: matchedDonors,
          emergencyRequests: (directoryContext.emergencyRequests || []).slice(0, 6),
          donationNumbers: directoryContext.donationNumbers || [],
          verifiedHotlines: [
            { name: "জাতীয় জরুরি সেবা", number: "999" },
            { name: "সরকারি তথ্য ও সেবা", number: "333" },
            { name: "নোয়াখালী ফায়ার সার্ভিস", number: "01730-002444" },
            { name: "নোয়াখালী জেনারেল হাসপাতাল", number: "01730-324794" },
            { name: "সুধারাম মডেল থানা পুলিশ", number: "01320-116035" },
          ],
        });

        const systemInstruction = `You are "${botName}", the official digital citizen assistant for Smart Noakhali (স্মার্ট নোয়াখালী).
${toneGuide}
${aiConfig?.systemInstructions ? `Admin Instructions: ${aiConfig.systemInstructions}` : ""}

STRICT GROUNDING & ACCURACY RULES:
1. Only state Noakhali directory listings, contacts, hospitals, police, fire stations, blood donors, and donation numbers verified in the JSON context below. Never invent any phone number or listing.
2. Understand phonetic Bengali/Banglish queries seamlessly (e.g. "noyakhali haspatal", "maijdee daktar", "roktodata").
3. Format phone numbers clearly with 📞 emoji and bold service names.
4. If the requested local service is missing from the directory context, state so clearly and suggest connecting to a human operator via Live Chat.

Verified Smart Noakhali Knowledge Base & Directory Context:
${contextSummary}`;

        const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
        for (const h of history.slice(-6)) {
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

        const response = await ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents,
          config: {
            systemInstruction,
          },
        });
        generatedText = (response.text || "").trim();
        if (!generatedText) {
          aiErrorMsg = "Gemini API খালি উত্তর পাঠিয়েছে";
          upstreamStatus = 502;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Gemini request failed";
        aiErrorMsg = msg;
        upstreamStatus = /(429|quota|rate.?limit|resource.?exhausted)/i.test(msg) ? 429 : 502;
        console.warn("Edge Gemini call issue:", msg);
      }
    }

    if (generatedText) {
      const wantsHandoff =
        /(লাইভ চ্যাট|অপারেটর|প্রতিনিধি|জানা নেই|তালিকায় নেই|পাওয়া যায়নি)/i.test(generatedText);
      return new Response(
        JSON.stringify({
          ok: true,
          text: generatedText,
          reply: generatedText,
          suggestHandoff: wantsHandoff,
          matches: {
            submissions: matchedSubmissions,
            donors: matchedDonors,
            categories: matchedCategories,
          },
          sources: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    const fallbackParts: string[] = [];
    if (matchedFaqs.length > 0) {
      matchedFaqs.forEach((f) => {
        fallbackParts.push(`📌 **${f.question}**\n${f.answer}`);
      });
    }
    if (matchedDonors.length > 0) {
      fallbackParts.push(`🩸 **রক্তদাতা তথ্য (${matchedDonors.length} জন):**`);
      matchedDonors.slice(0, 5).forEach((d, i) => {
        fallbackParts.push(
          `${i + 1}. **${d.full_name}** (${d.blood_group}) — 📞 [${d.phone}](tel:${d.phone.replace(/\D/g, "")})${d.address ? ` • 📍 ${d.address}` : ""}`
        );
      });
    }
    if (matchedSubmissions.length > 0) {
      fallbackParts.push(`📋 **যাচাইকৃত ডিরেক্টরি তথ্য (${matchedSubmissions.length} টি):**`);
      matchedSubmissions.slice(0, 5).forEach((s, i) => {
        fallbackParts.push(
          `${i + 1}. **${s.title}**${s.designation ? ` (${s.designation})` : ""}${
            s.contact ? ` — 📞 [${s.contact}](tel:${s.contact.replace(/\D/g, "")})` : ""
          }${s.address ? ` • 📍 ${s.address}` : ""}`
        );
      });
    }
    if (fallbackParts.length === 0) {
      fallbackParts.push(
        `স্মার্ট নোয়াখালী ডিরেক্টরি তথ্য: জরুরি যোগাযোগের জন্য:`
      );
      fallbackParts.push("• **জাতীয় জরুরি সেবা:** 📞 [999](tel:999)");
      fallbackParts.push("• **সরকারি তথ্য সেবা:** 📞 [333](tel:333)");
      fallbackParts.push("• **নোয়াখালী জেনারেল হাসপাতাল:** 📞 [01730-324794](tel:01730324794)");
      fallbackParts.push("• **নোয়াখালী ফায়ার সার্ভিস:** 📞 [01730-002444](tel:01730002444)");
    }
    fallbackParts.push(
      "\n💬 সরাসরি অপারেটরের সহায়তা পেতে নিচের **'লাইভ চ্যাট'** / হিউম্যান সাপোর্ট বাটনে ট্যাপ করুন।"
    );

    const finalFallback = fallbackParts.join("\n");
    return new Response(
      JSON.stringify({
        ok: false,
        error: aiErrorMsg || "এআই সেবা সাময়িকভাবে অনুপলব্ধ — ভেরিফায়েড ডিরেক্টরি তথ্য দেখানো হচ্ছে।",
        mode: apiKey ? "upstream_fallback" : "directory_lookup",
        fallbackText: finalFallback,
        text: finalFallback,
        reply: finalFallback,
        suggestHandoff: true,
        matches: {
          submissions: matchedSubmissions,
          donors: matchedDonors,
          categories: matchedCategories,
        },
        sources: [],
      }),
      {
        status: upstreamStatus,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal server error",
        suggestHandoff: true,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
};
