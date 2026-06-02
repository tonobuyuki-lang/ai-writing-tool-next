// Gemini 生成 API（サーバー専用）。
// APIキーはここでしか使わないため、ブラウザ／第三者に漏れない。
// クライアントは toolKey・入力値・model・temperature を送り、ここでプロンプトを組み立てる。

import { GoogleGenAI } from "@google/genai";
import { TOOLS_BY_KEY, DEFAULT_MODEL } from "@/lib/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerateBody {
  toolKey: string;
  values: Record<string, string | number>;
  model?: string;
  temperature?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY が設定されていません（サーバー環境変数）。" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "リクエスト形式が不正です。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tool = TOOLS_BY_KEY[body.toolKey];
  if (!tool) {
    return new Response(JSON.stringify({ error: "不明なツールです。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = tool.buildPrompt(body.values ?? {});
  const model = body.model || DEFAULT_MODEL;
  const temperature = typeof body.temperature === "number" ? body.temperature : tool.temperature;

  const ai = new GoogleGenAI({ apiKey });

  // 503/429 は一時的なことが多いので指数バックオフでリトライ
  const maxRetries = 4;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model,
        contents: prompt,
        config: {
          temperature,
          systemInstruction: tool.system,
        },
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of responseStream) {
              const text = chunk.text;
              if (text) controller.enqueue(encoder.encode(text));
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      lastErr = e;
      const msg = String(e);
      const transient = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("429");
      if (transient && attempt < maxRetries) {
        await sleep(2 ** attempt * 1000); // 1,2,4,8 秒
        continue;
      }
      break;
    }
  }

  const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
  return new Response(JSON.stringify({ error: `生成に失敗しました: ${detail}` }), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
}
