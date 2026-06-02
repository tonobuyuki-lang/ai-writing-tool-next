"use client";

import { useMemo, useState } from "react";
import { TOOLS, MODELS, DEFAULT_MODEL, type Tool, type ToolField } from "@/lib/tools";

export default function Home() {
  const [activeKey, setActiveKey] = useState(TOOLS[0].key);
  const tool = useMemo(() => TOOLS.find((t) => t.key === activeKey)!, [activeKey]);

  const [values, setValues] = useState<Record<string, string | number>>({});
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [temperature, setTemperature] = useState<number>(tool.temperature);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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

  // 先頭の text / textarea を必須入力とみなす
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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
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
    setTimeout(() => setCopied(false), 1500);
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
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      {/* サイドバー */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-white p-4 sm:flex">
        <h1 className="mb-1 text-lg font-bold">🖊️ AIライティング</h1>
        <p className="mb-4 text-xs text-neutral-500">個人用ツール</p>
        <nav className="flex flex-col gap-1">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              onClick={() => selectTool(t)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                t.key === activeKey
                  ? "bg-blue-600 text-white"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* メイン */}
      <main className="flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {/* モバイル用ツール選択 */}
          <div className="mb-4 sm:hidden">
            <select
              value={activeKey}
              onChange={(e) => selectTool(TOOLS.find((t) => t.key === e.target.value)!)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              {TOOLS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </div>

          <header className="mb-6">
            <h2 className="text-2xl font-bold">
              {tool.icon} {tool.label}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">{tool.description}</p>
          </header>

          {/* 入力フォーム */}
          <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
            {tool.fields.map((f) => (
              <Field key={f.key} field={f} value={values[f.key]} onChange={setField} />
            ))}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">モデル</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">
                  創造性 (temperature): {temperature.toFixed(1)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full"
                />
              </label>
            </div>

            <button
              onClick={generate}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "生成中…" : "✨ 生成する"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 生成結果 */}
          {(result || loading) && (
            <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">生成結果</h3>
                {result && (
                  <div className="flex gap-2">
                    <button
                      onClick={copyResult}
                      className="rounded-md border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
                    >
                      {copied ? "コピーしました" : "📋 コピー"}
                    </button>
                    <button
                      onClick={downloadResult}
                      className="rounded-md border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
                    >
                      📥 保存
                    </button>
                  </div>
                )}
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-neutral-800">
                {result}
                {loading && <span className="animate-pulse">▌</span>}
              </pre>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ToolField;
  value: string | number | undefined;
  onChange: (key: string, v: string | number) => void;
}) {
  const base =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{field.label}</span>
      {field.type === "text" && (
        <input
          type="text"
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={base}
        />
      )}
      {field.type === "textarea" && (
        <textarea
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
          rows={6}
          className={base}
        />
      )}
      {field.type === "select" && (
        <select
          value={(value as string) ?? field.options?.[0]}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={base}
        >
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
      {field.type === "slider" && (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={(value as number) ?? field.default ?? field.min}
            onChange={(e) => onChange(field.key, Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-8 text-sm text-neutral-600">
            {(value as number) ?? field.default ?? field.min}
          </span>
        </div>
      )}
    </label>
  );
}
