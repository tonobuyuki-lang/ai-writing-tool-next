# 🖊️ AIライティングツール（Next.js版）

Next.js + Vercel + Gemini API で作る、オールインワンのライティング支援ツール。
APIキーはサーバー側(API Route)でのみ使用するため、ブラウザ／第三者に漏れません。

## 搭載ツール

| ツール | 用途 |
|--------|------|
| 📝 ブログ記事執筆 | テーマ・キーワードから構成付き記事を生成 |
| ✉️ メール返信文作成 | 受信メールに対する返信文を作成 |
| 📋 文章要約 | 長文を指定形式・長さで要約 |
| ✨ 校正・リライト | 誤字脱字修正・トーン変換 |
| 🌐 翻訳 | 自然な多言語翻訳 |
| 📱 SNS投稿生成 | 各SNS向け投稿文を3案生成 |
| 💡 タイトル・見出し案 | クリックされやすい案を複数提案 |

機能追加は `lib/tools.ts` に `Tool` を足すだけ（UIは自動生成）。

## モデル選択（費用対効果）

| モデル | 入力/出力(100万トークン) | 用途 |
|--------|--------------------------|------|
| **gemini-2.5-flash**（デフォルト） | $0.30 / $2.50 | 品質・速度・コストの最良バランス |
| gemini-2.5-flash-lite | $0.10 / $0.40 | 要約・翻訳など軽量タスク向け（最安） |
| gemini-2.5-pro | $1.25 / $10.00 | 高品質が必要な時のみ |

## ローカル起動

```bash
cd projects/ai-writing-tool-next

# 1. APIキー設定
cp .env.example .env.local   # .env.local を編集して GEMINI_API_KEY を記入

# 2. 起動
npm install
npm run dev
# → http://localhost:3000
```

APIキーは [Google AI Studio](https://aistudio.google.com/apikey) で無料取得できます。

## Vercel へのデプロイ

1. GitHub にリポジトリを push
2. [vercel.com](https://vercel.com) で「Add New → Project」→ リポジトリを Import
3. **Environment Variables** に `GEMINI_API_KEY` を登録（Value に本物のキー）
4. Deploy → `https://〇〇.vercel.app` で公開

以降は `git push` するたびに自動で再デプロイされます。

> Streamlit版と違い、APIキーはサーバー側でのみ使われるため、
> アプリURLを公開しても閲覧者にキーは渡りません。ただし誰でも
> 生成機能を使える状態にはなるので、必要に応じて Vercel の
> Password Protection 等でアクセス制限してください。

## 構成

```
ai-writing-tool-next/
├── app/
│   ├── page.tsx              # メイン画面（クライアント・UI動的生成）
│   ├── layout.tsx
│   └── api/generate/route.ts # Gemini 呼び出し（サーバー専用・ストリーミング）
├── lib/
│   └── tools.ts              # 7ツール定義 + モデル一覧
├── .env.example
└── README.md
```
