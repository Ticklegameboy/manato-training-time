# 真斗のトレーニングタイム

懸垂に励む真斗に、親しい相棒としてちょっといたずら。体力に合わせて表情や動き、セリフが変わる、縦画面のドット絵ブラウザゲームです。

**[▶ ブラウザで遊ぶ](https://ticklegameboy.github.io/manato-training-time/)**

## 遊び方

1. 読み込みが終わったら、画面左下で言語を選び、「ゲーム開始」を押します。
2. 脇、脇腹、腹筋、おへそをタップするか、長押ししたままなぞってみてください。
3. 手を止めると体力が回復します。体力を削り切るとエンディングへ進みます。
4. 「もう一度」で最初から遊べます。

## このバージョン

- 日本語・繁體中文・Englishに対応。初期言語は繁體中文です。
- 体力の残量に応じて、懸垂、ぶら下がり、笑い、息切れのアニメーションが変化します。
- セリフは頭の近くに浮かび、反応した部位や状態によって内容と色が変わります。
- 有効なタップでピクセルエフェクトが発生。クリティカル時には金色の「Burst」が表示されます。
- 最初の白いタンクトップの背景を採用。読み込み中のミニキャラは、最初の素材の1・2コマを70ミリ秒ずつ交互に表示します。
- 開始・リスタート時には画面全体を覆うピクセルトランジション、エンディングにはB版の息切れループを使用しています。

## 動作環境

スマートフォン・PCの新しいブラウザで動作します。インストール不要です。初回は画像の読み込みに少し時間がかかります。

HTML・CSS・JavaScriptだけで動作する静的サイトです。GitHub Pagesでは `main` ブランチのルートから配信します。ローカルで実行する場合は、ファイルをダウンロードしてHTTPサーバーから開いてください。

本作は非公式のファン制作ゲームです。登場キャラクターに関する権利は各権利者に帰属します。

## 音声・音楽・体力ゲージの更新

- 笑い声は状態に応じてランダム再生し、同じ音声の連続を防ぎます。笑い声は落下中も続き、エンディング表示時に短くフェードアウトします。
- BGMは初期設定でオンです。ブラウザが自動再生を制限する場合は最初の操作で再生します。ゲーム中は右上の音符ボタンでBGMを切り替えられます。
- タイトルは「Voxel Revolution」、ゲーム中は「Blippy Trance」、エンディングは「Bit Shift」。ゲーム中はボイスに合わせてBGMの音量を抑えます。
- 新しい体力段階に初めて到達すると、85%・65%・35%の境界に斜線が順に表示されます。同じブラウザで記録を保持します。
- 体力回復は徐々に加速し、上限は毎秒10です。浮かぶセリフは体力ゲージより手前に表示します。

## Music credits / 音樂鳴謝 / 音楽クレジット

Music by **Kevin MacLeod** — [incompetech.com](https://incompetech.com/).

All three tracks are licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

音樂檔案未剪輯；遊戲中循環播放，調整音量並加入場景淡入淡出及配音期間壓低音量。

音源ファイルは未編集です。ゲーム内でループ再生・音量調整・フェード・ボイス再生中の音量抑制を行います。

Audio files are unedited. In-game playback adds looping, volume adjustments, fades and ducking under voice clips.

- **Voxel Revolution** — 開場 / Title
  Kevin MacLeod (incompetech.com). [Official track](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN2000025). [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- **Blippy Trance** — 遊戲 / Gameplay
  Kevin MacLeod (incompetech.com). [Official track](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1900055). [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- **Bit Shift** — 結局 / Ending
  Kevin MacLeod (incompetech.com). [Official track](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600045). [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
