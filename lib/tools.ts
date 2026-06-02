// ライティングツール定義集（Python版 core/tools.py の TypeScript 移植）。
// 新しいツールは TOOLS 配列に追加するだけで、UI（フォーム・サイドバー）が自動生成される。

export type FieldType = "text" | "textarea" | "select" | "slider";

export interface ToolField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[]; // select 用
  min?: number; // slider 用
  max?: number;
  default?: number;
  step?: number;
}

export interface Tool {
  key: string;
  label: string;
  icon: string;
  description: string;
  system: string; // システムインストラクション（役割付け）
  fields: ToolField[];
  buildPrompt: (v: Record<string, string | number>) => string;
  temperature: number;
}

const s = (v: Record<string, string | number>, k: string) => String(v[k] ?? "");

// 1. ブログ記事執筆
const blogWriter: Tool = {
  key: "blog",
  label: "ブログ記事執筆",
  icon: "📝",
  description: "テーマとキーワードから構成立てされたブログ記事を執筆します。",
  system:
    "あなたはプロのブログライター兼SEO編集者です。読者にとって価値があり、" +
    "読みやすく、検索エンジンにも評価される日本語の記事を書きます。" +
    "見出し(Markdown)を適切に使い、結論先行・具体例つきで執筆してください。",
  fields: [
    { key: "topic", label: "記事のテーマ", type: "text", placeholder: "例: リモートワークで集中力を保つ方法" },
    { key: "keywords", label: "盛り込みたいキーワード（任意・カンマ区切り）", type: "text", placeholder: "例: 集中力, ポモドーロ, 在宅" },
    { key: "audience", label: "想定読者", type: "text", placeholder: "例: 在宅勤務を始めたばかりの会社員" },
    { key: "tone", label: "トーン", type: "select", options: ["親しみやすい", "専門的", "カジュアル", "丁寧・フォーマル"] },
    { key: "length", label: "目安の文字数", type: "select", options: ["800字程度", "1500字程度", "3000字程度", "5000字以上"] },
  ],
  buildPrompt: (v) =>
    `以下の条件でブログ記事をMarkdownで執筆してください。\n\n` +
    `# テーマ\n${s(v, "topic")}\n\n` +
    `# 想定読者\n${s(v, "audience") || "一般読者"}\n\n` +
    `# 盛り込むキーワード\n${s(v, "keywords") || "指定なし"}\n\n` +
    `# トーン\n${s(v, "tone")}\n\n` +
    `# 分量\n${s(v, "length")}\n\n` +
    `タイトル案・導入・本文（見出し付き）・まとめ の構成で書いてください。`,
  temperature: 0.8,
};

// 2. メール返信文作成
const emailReplier: Tool = {
  key: "email",
  label: "メール返信文作成",
  icon: "✉️",
  description: "受信したメールに対する適切な返信文を作成します。",
  system:
    "あなたはビジネスコミュニケーションの専門家です。状況に応じて適切な敬語・" +
    "トーンで、簡潔かつ失礼のない日本語のメール文面を作成します。",
  fields: [
    { key: "received", label: "受信したメール本文", type: "textarea", placeholder: "返信したい相手から届いたメールを貼り付け" },
    { key: "intent", label: "返信で伝えたいこと", type: "textarea", placeholder: "例: 日程はOK。場所だけ変更したい旨を伝える" },
    { key: "relation", label: "相手との関係", type: "select", options: ["社外の取引先", "社内の上司", "社内の同僚", "初めて連絡する相手", "顧客"] },
    { key: "tone", label: "トーン", type: "select", options: ["丁寧・フォーマル", "標準的なビジネス", "ややカジュアル"] },
  ],
  buildPrompt: (v) =>
    `以下のメールに対する返信文を作成してください。件名案も冒頭に付けてください。\n\n` +
    `# 相手との関係\n${s(v, "relation")}\n\n` +
    `# トーン\n${s(v, "tone")}\n\n` +
    `# 受信したメール\n${s(v, "received")}\n\n` +
    `# 返信で伝えたい内容\n${s(v, "intent")}`,
  temperature: 0.6,
};

// 3. 文章要約
const summarizer: Tool = {
  key: "summary",
  label: "文章要約",
  icon: "📋",
  description: "長い文章を指定の形式・長さで要約します。",
  system:
    "あなたは正確な要約のプロです。元の文章の主旨を歪めず、重要な情報を漏らさずに、" +
    "指定された形式で日本語要約します。",
  fields: [
    { key: "text", label: "要約したい文章", type: "textarea", placeholder: "記事・議事録・資料などを貼り付け" },
    { key: "format", label: "出力形式", type: "select", options: ["箇条書き", "短い段落", "1行で", "見出し付き要点整理"] },
    { key: "length", label: "要約の長さ", type: "select", options: ["ごく短く", "標準", "やや詳しく"] },
  ],
  buildPrompt: (v) =>
    `次の文章を「${s(v, "format")}」形式・「${s(v, "length")}」で要約してください。\n\n---\n${s(v, "text")}`,
  temperature: 0.3,
};

// 4. 文章校正・リライト
const rewriter: Tool = {
  key: "rewrite",
  label: "校正・リライト",
  icon: "✨",
  description: "誤字脱字の修正や、指定トーンへの書き換えを行います。",
  system:
    "あなたは熟練の編集者・校正者です。意味を変えずに、読みやすく自然な日本語に" +
    "整えます。修正後の文章を出力し、最後に主な修正点を箇条書きで補足してください。",
  fields: [
    { key: "text", label: "対象の文章", type: "textarea", placeholder: "校正・リライトしたい文章を貼り付け" },
    { key: "mode", label: "処理内容", type: "select", options: ["誤字脱字・文法の校正のみ", "読みやすくリライト", "もっと丁寧に", "もっと簡潔に", "指定トーンに変換"] },
    { key: "tone", label: "変換したいトーン（「指定トーンに変換」時）", type: "text", placeholder: "例: 親しみやすいSNS風" },
  ],
  buildPrompt: (v) =>
    `次の文章を「${s(v, "mode")}」してください。` +
    (s(v, "tone") ? `（目標トーン: ${s(v, "tone")}）` : "") +
    `\n\n---\n${s(v, "text")}`,
  temperature: 0.5,
};

// 5. 翻訳
const translator: Tool = {
  key: "translate",
  label: "翻訳",
  icon: "🌐",
  description: "自然な翻訳を行います。直訳ではなくニュアンスを汲みます。",
  system:
    "あなたはプロの翻訳者です。逐語訳ではなく、対象言語として自然で読みやすい" +
    "表現に翻訳します。固有名詞や専門用語は適切に扱います。",
  fields: [
    { key: "text", label: "翻訳したい文章", type: "textarea" },
    { key: "target", label: "翻訳先の言語", type: "select", options: ["英語", "日本語", "中国語(簡体字)", "韓国語", "フランス語", "スペイン語"] },
    { key: "style", label: "文体", type: "select", options: ["標準", "ビジネス・フォーマル", "カジュアル"] },
  ],
  buildPrompt: (v) =>
    `次の文章を${s(v, "target")}に翻訳してください。文体は「${s(v, "style")}」。` +
    `翻訳文のみを出力してください。\n\n---\n${s(v, "text")}`,
  temperature: 0.3,
};

// 6. SNS投稿生成
const snsWriter: Tool = {
  key: "sns",
  label: "SNS投稿生成",
  icon: "📱",
  description: "テーマから各SNS向けの投稿文を生成します。",
  system:
    "あなたはSNSマーケティングの専門家です。各プラットフォームの特性・文字数感・" +
    "ハッシュタグ文化を理解した投稿文を作ります。",
  fields: [
    { key: "topic", label: "投稿したい内容・テーマ", type: "textarea" },
    { key: "platform", label: "プラットフォーム", type: "select", options: ["X (Twitter)", "Instagram", "LinkedIn", "Facebook", "note"] },
    { key: "goal", label: "投稿の目的", type: "select", options: ["認知拡大", "エンゲージメント獲得", "告知・集客", "教育・情報提供"] },
    { key: "hashtags", label: "ハッシュタグを付ける", type: "select", options: ["付ける", "付けない"] },
  ],
  buildPrompt: (v) =>
    `${s(v, "platform")} 向けの投稿文を作成してください。\n` +
    `目的: ${s(v, "goal")}\n` +
    `ハッシュタグ: ${s(v, "hashtags")}\n\n` +
    `プラットフォームに最適な長さ・トーンで、3案出してください。\n\n` +
    `# 投稿テーマ\n${s(v, "topic")}`,
  temperature: 0.9,
};

// 7. タイトル・キャッチコピー案出し
const titleMaker: Tool = {
  key: "title",
  label: "タイトル・見出し案",
  icon: "💡",
  description: "クリックされやすいタイトルやキャッチコピーを複数提案します。",
  system:
    "あなたは反応率を熟知したコピーライターです。ターゲットの心に刺さる、" +
    "具体性とベネフィットのある案を出します。",
  fields: [
    { key: "content", label: "内容・概要", type: "textarea", placeholder: "記事や商品・サービスの概要" },
    { key: "kind", label: "用途", type: "select", options: ["ブログ記事タイトル", "YouTube動画タイトル", "メール件名", "広告キャッチコピー", "プレゼン資料タイトル"] },
    { key: "count", label: "案の数", type: "slider", min: 3, max: 15, default: 8, step: 1 },
  ],
  buildPrompt: (v) =>
    `次の内容に対する「${s(v, "kind")}」の案を${Number(v.count ?? 8)}個、番号付きで` +
    `提案してください。それぞれ簡単に狙いも添えてください。\n\n# 内容\n${s(v, "content")}`,
  temperature: 0.95,
};

export const TOOLS: Tool[] = [
  blogWriter,
  emailReplier,
  summarizer,
  rewriter,
  translator,
  snsWriter,
  titleMaker,
];

export const TOOLS_BY_KEY: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.key, t]),
);

// 費用対効果を考慮したモデル選択。
// デフォルトは gemini-2.5-flash（品質/速度/コストの最良バランス）。
// 単純タスク向けに flash-lite（最安）も選べる。
export const MODELS = [
  { id: "gemini-2.5-flash", label: "Flash（推奨・バランス型）" },
  { id: "gemini-2.5-flash-lite", label: "Flash-Lite（最安・軽量タスク向け）" },
  { id: "gemini-2.5-pro", label: "Pro（高品質・高コスト）" },
];
export const DEFAULT_MODEL = MODELS[0].id;
