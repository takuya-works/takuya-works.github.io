# 😊 T.Yamada Portfolio Site

Webライター × アプリ開発者のポートフォリオサイト

## 🎨 デザインコンセプト

**明るいNetflix風デザイン** - ダークではなく、明るくモダンなカラースキームを採用
- ベース: ホワイト (#ffffff) + ライトグレー (#f5f5f5)
- アクセント: Netflixレッド (#E50914)
- Netflix風の横スクロールカード＆ホバーエフェクト

## ✅ 実装済み機能

### 1. ナビゲーション
- 固定ヘッダー（スクロールで背景変化）
- スムーススクロール
- モバイル対応ハンバーガーメニュー

### 2. ヒーローセクション
- グラデーション背景アニメーション
- キャッチコピー「笑顔でつなぐ、言葉とコード」
- プロフィール写真プレースホルダー
- CTAボタン（お問い合わせ / 実績を見る）

### 3. 執筆実績セクション
- Netflix風横スクロールカルーセル
- ホバーで拡大 + オーバーレイ表示
- サンプル実績5件
  - IT企業のオウンドメディア（SEO記事）
  - ライフスタイルメディア（コラム）
  - スタートアップ取材記事
  - ECサイトLP制作
  - ビジネス書執筆協力

### 4. アプリ開発セクション
- 同様の横スクロールカルーセル
- サンプルアプリ4件
  - SmileTask（iOS/Android）
  - WritersHub（Webアプリ）
  - FocusMode（Chrome拡張）
  - 毎日ポジティブBot（LINE Bot）

### 5. About Meセクション
- プロフィール写真プレースホルダー
- 自己紹介文
- スキルバー（アニメーション付き）
  - SEOライティング 95%
  - 取材・インタビュー 90%
  - Flutter/Dart 80%
  - React/JavaScript 75%
  - Python 70%

### 6. Contactセクション
- お問い合わせフォーム（バリデーション付き）
- SNSリンク（サンプル）
  - X(Twitter): @takeshi_writes
  - GitHub: takeshi-dev
  - Instagram: @takeshi.life
  - note: takeshi_note

### 7. フッター
- ロゴ＆タグライン
- SNSアイコンリンク
- コピーライト

## 📁 ファイル構成

```
/
├── index.html          # メインHTML
├── css/
│   └── style.css       # スタイルシート
├── js/
│   └── main.js         # JavaScript
└── README.md           # このファイル
```

## 🔗 機能エントリーポイント

| セクション | アンカー |
|-----------|---------|
| ホーム | `#home` |
| 執筆実績 | `#writing` |
| アプリ開発 | `#apps` |
| About | `#about` |
| Contact | `#contact` |

## 📝 今後のカスタマイズ

### 写真の追加方法
1. `index.html`内の `.profile-placeholder` を以下に置き換え:
```html
<img src="images/profile.jpg" alt="山田健史" class="profile-image">
```

2. CSSに追加:
```css
.profile-image {
    width: 350px;
    height: 350px;
    border-radius: 50%;
    object-fit: cover;
}
```

### SNSアカウントの変更
`index.html`内の以下のリンクを編集:
- Twitter: `https://twitter.com/YOUR_HANDLE`
- GitHub: `https://github.com/YOUR_USERNAME`
- Instagram: `https://www.instagram.com/YOUR_HANDLE`
- note: `https://note.com/YOUR_USERNAME`

### 実績の追加・編集
`index.html`内の `.carousel` セクションにカードを追加/編集

## 🚀 公開方法

**Publishタブ** からワンクリックで無料公開できます！

## 🛠️ 使用技術

- HTML5
- CSS3 (カスタムプロパティ、Flexbox、Grid)
- Vanilla JavaScript
- Google Fonts (Noto Sans JP, Poppins)
- Font Awesome 6

## 📅 更新履歴

- 2024/12 - 初版作成（サンプルデータ）
