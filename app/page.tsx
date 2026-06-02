"use client";
/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 【Next.js版: クライアントコンポーネント（UI専任）】
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * このファイルはブラウザで動く。APIキーには一切触れない。
 * 生成ボタンを押すと /api/generate（route.ts）へ POST し、
 * ストリーミングレスポンスを reader.read() で逐次受信して表示する。
 *
 * 【Streamlit版（app.py）との比較】
 *   Streamlit: UIとロジックが app.py 1ファイルに同居。
 *              st.write_stream(stream) の1行でストリーミング表示。
 *              APIキーをサイドバーから直接 Python 関数に渡せる。
 *
 *   Next.js  : UIはこのファイル（ブラウザ）、APIはroute.ts（サーバー）に分離。
 *              fetch + ReadableStream で手動ストリーミング受信。
 *              APIキーはブラウザに届かない（route.tsのみが保持）。
 */

import { useMemo, useState } from "react";
import { TOOLS, MODELS, DEFAULT_MODEL, type Tool, type ToolField } from "@/lib/tools";

export default function Home() {
  const [activeKey, setActiveKey] = useState(TOOLS[0].key);
  const tool = useMemo(() => TOOLS.find((t) => t.key === activeKey)!, [activeKey]);

  const [values, setValues]       = useState<Record<string, string | number>>({});
  const [model, setModel]         = useState(DEFAULT_MODEL);
  const [temperature, setTemperature] = useState<number>(tool.temperature);
  const [result, setResult]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [copied, setCopied]       = useState(false);

  function selectTool(t: Tool) {
    setActiveKey(t.key);
    setValues({});
    setResult("");
    setError("");
    setTemperature(t.temperature);
  }

  function setField(key: string, v: string | number) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function requiredFilled(): boolean {
    const f = tool.fields.find((x) => x.type === "text" || x.type === "textarea");
    if (!f) return true;
    return String(values[f.key] ?? "").trim().length > 0;
  }

  async function generate() {
    if (!requiredFilled()) {
      setError("必要な入力が空です。テキストを入力してください。");
      return;
    }
    setError("");
    setResult("");
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolKey: tool.key, values, model, temperature }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "生成に失敗しました。" }));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      // ▼ Next.js版のストリーミング受信: reader.read() ループで逐次取得・表示
      //   Streamlit版では st.write_stream(generator) の1行だけでここ全体を担う
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc); // チャンクが届くたびに画面を更新（リアルタイム表示）
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function downloadResult() {
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tool.key}_result.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* ══ サイドバー ══ */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">🖊️ AIライティング</div>
          <div className="sidebar-logo-sub">個人用ツール</div>
        </div>
        <nav className="sidebar-nav">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              onClick={() => selectTool(t)}
              className={`tool-item${t.key === activeKey ? " active" : ""}`}
            >
              <span className="tool-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ══ メインコンテンツ ══ */}
      <main className="main-content">
        <div className="content-inner">

          {/* モバイル用ツール選択 */}
          <div className="mobile-tool-select">
            <select
              value={activeKey}
              onChange={(e) => selectTool(TOOLS.find((t) => t.key === e.target.value)!)}
              className="form-select"
            >
              {TOOLS.map((t) => (
                <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>

          {/* ツールヘッダー */}
          <header className="tool-header" key={tool.key}>
            <h1 className="tool-header-title">
              <span className="tool-emoji">{tool.icon}</span>
              {tool.label}
            </h1>
            <p className="tool-header-desc">{tool.description}</p>
          </header>

          {/* 入力フォーム */}
          <div className="form-card">
            {tool.fields.map((f) => (
              <Field
                key={`${tool.key}-${f.key}`}
                field={f}
                value={values[f.key]}
                onChange={setField}
              />
            ))}

            <div className="controls-row">
              {/* モデル選択 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">モデル</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="form-select"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* 創造性スライダー */}
              <div>
                <div className="range-header">
                  <span className="form-label">創造性</span>
                  <span className="range-badge">{temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0} max={1} step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                />
                <div className="range-hints">
                  <span className="range-hint">堅実</span>
                  <span className="range-hint">創造的</span>
                </div>
              </div>
            </div>

            {/* 生成ボタン */}
            <button
              onClick={generate}
              disabled={loading}
              className="btn-generate"
            >
              {loading ? (
                <span className="btn-loading">
                  <span>生成中</span>
                  <span className="loading-dots">
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                  </span>
                </span>
              ) : (
                "✨ 生成する"
              )}
            </button>
          </div>

          {/* エラー */}
          {error && <div className="error-box">{error}</div>}

          {/* 生成結果 */}
          {(result || loading) && (
            <div className="result-card">
              <div className="result-header">
                <span className="result-label">
                  <span className="result-live-dot" />
                  生成結果
                </span>
                {result && (
                  <div className="result-actions">
                    <button
                      onClick={copyResult}
                      className={`btn-action${copied ? " copied" : ""}`}
                    >
                      {copied ? "✓ コピー完了" : "📋 コピー"}
                    </button>
                    <button onClick={downloadResult} className="btn-action">
                      📥 保存
                    </button>
                  </div>
                )}
              </div>
              <div className="result-body">
                {result}
                {loading && <span className="stream-cursor" />}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   フィールドコンポーネント（動的フォーム生成）
   ══════════════════════════════════════════════════════ */
function Field({
  field,
  value,
  onChange,
}: {
  field: ToolField;
  value: string | number | undefined;
  onChange: (key: string, v: string | number) => void;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{field.label}</label>

      {field.type === "text" && (
        <input
          type="text"
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="form-input"
        />
      )}

      {field.type === "textarea" && (
        <textarea
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="form-textarea"
        />
      )}

      {field.type === "select" && (
        <select
          value={(value as string) ?? field.options?.[0]}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="form-select"
        >
          {field.options?.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}

      {field.type === "slider" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="range"
            min={field.min} max={field.max}
            step={field.step ?? 1}
            value={(value as number) ?? field.default ?? field.min}
            onChange={(e) => onChange(field.key, Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span className="range-badge">
            {(value as number) ?? field.default ?? field.min}
          </span>
        </div>
      )}
    </div>
  );
}
