/**
 * Gemini 生成 API Route（サーバー専用）
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 【Next.js版のアーキテクチャ】
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   ブラウザ (page.tsx)          サーバー (このファイル)
 *  ┌─────────────────────┐      ┌─────────────────────┐
 *  │ フォーム入力         │      │ GEMINI_API_KEY       │
 *  │ toolKey, values     │ POST │ ← 環境変数のみ       │
 *  │ model, temperature  │ ───→ │ プロンプト組み立て   │
 *  │                     │      │ Gemini API 呼び出し  │
 *  │ reader.read() ループ│ ←── │ ReadableStream で返す│
 *  │ でリアルタイム表示   │stream│                     │
 *  └─────────────────────┘      └─────────────────────┘
 *
 * APIキーはこのファイルの process.env からしか読まない。
 * ブラウザ（page.tsx）は絶対にキーに触れない。
 *
 * 【Streamlit版との比較】
 *   Streamlit: UIとAPIキーが同一Pythonプロセス内に共存。
 *              ブラウザからキーを渡すことも可能（サイドバー入力）。
 *   Next.js  : UIとAPIが物理的に分離。キーはサーバー側に完全隔離。
 */

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

/**
 * 【リトライの実装比較】
 *
 * Next.js版（このファイル）:
 *   JavaScript は非同期なので Promise ベースの sleep が必要。
 *   await sleep(ms) = await new Promise(r => setTimeout(r, ms))
 *
 * Streamlit版（gemini_client.py）:
 *   Python の同期コードなので time.sleep(wait) と素直に書ける。
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  // ▼ APIキーはここだけで読む。NEXT_PUBLIC_ を付けないことでブラウザに漏れない。
  //   Streamlit版では os.getenv() に加え、サイドバー入力（override引数）でも渡せる。
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY が設定されていません（Vercel環境変数）。" }),
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

  // 503/429 は一時的なことが多いので指数バックオフでリトライ（1→2→4→8秒）
  const maxRetries = 4;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model,
        contents: prompt,
        config: { temperature, systemInstruction: tool.system },
      });

      /**
       * ▼ Next.js版のストリーミング: Web標準の ReadableStream を手動構築。
       *
       *   Streamlit版: st.write_stream(generator) の1行で完結。
       *                Streamlit がジェネレータを受け取り、画面への表示まで担う。
       *
       *   Next.js版  : ReadableStream を自前で作り、fetch レスポンスとして返す。
       *                クライアント（page.tsx）が reader.read() ループで逐次受信・表示。
       *                コードは増えるが、より細かい制御が可能。
       */
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
        // ▼ Next.js版のリトライ待機: Promise ベースの非同期 sleep
        //   Streamlit版では time.sleep(wait) と同期的に書ける
        await sleep(2 ** attempt * 1000);
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
