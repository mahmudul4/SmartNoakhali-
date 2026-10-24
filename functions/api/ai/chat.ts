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
    const history = Array.isArray(body.history) ? body.history : [];
    const directoryContext = body.directoryContext || {};

    if (!userQuery) {
      return new Response(JSON.stringify({ error: "প্রশ্ন লিখুন" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          text: "স্মার্ট নোয়াখালী এআই সহকারী: আপনার অনুসন্ধানের জন্য ধন্যবাদ। নোয়াখালীর যেকোনো সরকারি ও জরুরি সেবার জন্য আমাদের ৩৩৩ ও ৯৯৯ হটলাইন ব্যবহার করতে পারেন। (Cloudflare ড্যাশবোর্ডে GEMINI_API_KEY এনভায়রনমেন্ট ভেরিয়েবল সেট করলে এআই সম্পূর্ণ সক্রিয় হবে।)",
          sources: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    const defaultNoakhaliDirectory = [
      { title: "২৫০ শয্যা বিশিষ্ট নোয়াখালী জেনারেল হাসপাতাল", category: "হাসপাতাল", contact: "01730-324794", address: "মাইজদী কোর্ট, নোয়াখালী" },
      { title: "নোয়াখালী জেলা পুলিশ কন্ট্রোল রুম", category: "পুলিশ", contact: "01320-115998", address: "পুলিশ সুপারের কার্যালয়, মাইজদী" },
      { title: "সুধারাম মডেল থানা (নোয়াখালী সদর)", category: "পুলিশ", contact: "01320-116035", address: "মাইজদী, নোয়াখালী" },
      { title: "বেগমগঞ্জ মডেল থানা", category: "পুলিশ", contact: "01320-116065", address: "চৌমুহনী, নোয়াখালী" },
      { title: "নোয়াখালী ফায়ার সার্ভিস স্টেশন", category: "ফায়ার সার্ভিস", contact: "01730-002444", address: "মাইজদী কোর্ট, নোয়াখালী" },
      { title: "চৌমুহনী ফায়ার সার্ভিস স্টেশন", category: "ফায়ার সার্ভিস", contact: "01730-002445", address: "চৌমুহনী, বেগমগঞ্জ" },
      { title: "রেড ক্রিসেন্ট নোয়াখালী রক্তদান কেন্দ্র ও অ্যাম্বুলেন্স", category: "রক্তদান", contact: "01819-880099", address: "মাইজদী বাজার রোড" },
      { title: "জাতীয় জরুরি সেবা হটলাইন", category: "জরুরি", contact: "999", address: "সারাদেশ (২৪ ঘণ্টা ফ্রি)" },
      { title: "সরকারি তথ্য ও সেবা হটলাইন", category: "তথ্য", contact: "333", address: "সারাদেশ (২৪ ঘণ্টা ফ্রি)" },
    ];

    const contextSummary = JSON.stringify({
      emergencyDirectory: defaultNoakhaliDirectory,
      matchedDirectory: (directoryContext.submissions || []).slice(0, 15),
      bloodDonors: (directoryContext.donors || []).slice(0, 12),
      emergencyRequests: (directoryContext.emergencyRequests || []).slice(0, 6),
      donationNumbers: directoryContext.donationNumbers || [],
    });

    const systemInstruction = `You are the official Smart AI Assistant of "Smart Noakhali (স্মার্ট নোয়াখালী)" — an intelligent, versatile, multi-purpose assistant for both local Noakhali civic assistance and general-purpose problem solving.

PRIMARY CAPABILITIES:
1. General-Purpose Problem Solver: You are an expert at programming, software development (provide clean, production-grade code with markdown code blocks like \`\`\`javascript or \`\`\`python and clear explanations), mathematics, science, logical reasoning, document translation (Bengali <-> English), and creative drafting.
2. Smart Noakhali & Civic Assistance: When users ask about Noakhali district, local civic directory, hospitals, doctors, ambulances, fire stations, police stations, lawyers, blood donors, or emergency hotlines (999, 333), you ground your response accurately using the provided directory and emergency contacts.
3. Multilingual Excellence: Answer fluently in the language the user asked in (Bengali বাংলা or English). Use warm, polite, and respectful tone ("আপনি / আপনার").
4. Markdown Formatting: Use bold for key numbers or names, bullet points for lists, and code blocks for programming solutions. Always provide clear phone numbers with 📞 emoji for local contacts.

Local Smart Noakhali Directory Data:
${contextSummary}`;

    // Build multi-turn contents
    const contents: any[] = [];
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

    // Try gemini-3.8-flash first, cascade to gemini-flash-latest
    const candidateModels = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash"];
    let generatedText = "";

    for (const model of candidateModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const resp = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
            contents,
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2048,
            },
          }),
        });

        if (resp.ok) {
          const data: any = await resp.json();
          const cand = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (cand && cand.trim()) {
            generatedText = cand.trim();
            break;
          }
        }
      } catch {
        // try next model
      }
    }

    if (!generatedText) {
      return new Response(
        JSON.stringify({
          text: "দুঃখিত, এই মুহূর্তে এআই সার্ভিসে সংযোগ করা যায়নি। নোয়াখালীর যেকোনো জরুরি সেবায় ৯৯৯ (জাতীয় জরুরি সেবা) বা ৩৩৩ (তথ্য সেবা) নাম্বারে বিনামূল্যে কল করুন।",
          sources: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

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
