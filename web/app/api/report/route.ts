import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generate a risk report via any OpenAI-compatible Chat Completions endpoint.
// The offline provider is handled client-side, so this route only serves "openai".
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt: string = body?.prompt ?? "";
    const ai = body?.ai ?? {};
    if (!prompt) return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    if (!ai.apiKey || !ai.baseUrl) {
      return NextResponse.json({ error: "Missing API base URL or key." }, { status: 400 });
    }

    const base = String(ai.baseUrl).replace(/\/+$/, "");
    const resp = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model: ai.model || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `Upstream ${resp.status}: ${text.slice(0, 300)}` },
        { status: 502 }
      );
    }
    const data = await resp.json();
    const report = data?.choices?.[0]?.message?.content ?? "";
    if (!report) return NextResponse.json({ error: "Empty response from model." }, { status: 502 });
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
