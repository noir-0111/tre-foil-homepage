// Cloudflare Pages Function: POST /api/recruit
// 採用ページの申込みフォームを受け取り、Resend 経由でメール送信する。
// 必要な環境変数（Cloudflare Pages の Settings → Environment variables）:
//   RESEND_API_KEY : Resend の API キー
//   CONTACT_TO     : 受信したいメールアドレス
//   CONTACT_FROM   : 任意。送信元アドレス。未設定なら onboarding@resend.dev（Resendテスト用）

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// HTMLメールに差し込む前に値をエスケープ（表示崩れ・インジェクション防止）
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const form = await request.formData();
    const get = (k) => (form.get(k) || "").toString().trim();

    const name    = get("お名前");
    const kana    = get("ふりがな");
    const email   = get("メールアドレス");
    const tel     = get("電話番号");
    const job     = get("希望職種");
    const type    = get("希望雇用形態");
    const place   = get("希望勤務地");
    const license = get("歯科技工士免許");
    const exp     = get("実務経験");
    const message = get("ご質問・メッセージ");

    // サーバー側バリデーション（必須項目が未入力なら送信不可）
    if (!name || !kana || !email || !tel || !job || !type || !place) {
      return json({ ok: false, error: "未入力の項目があります。" }, 400);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ ok: false, error: "メールアドレスの形式が正しくありません。" }, 400);
    }

    const apiKey = env.RESEND_API_KEY;
    const to     = env.CONTACT_TO;
    const from   = env.CONTACT_FROM || "onboarding@resend.dev";
    if (!apiKey || !to) {
      return json({ ok: false, error: "サーバー設定が未完了です（環境変数を確認してください）。" }, 500);
    }

    // プレーンテキスト版（HTML非対応クライアント向けのフォールバック）
    const text =
`株式会社tre-foil ウェブサイトの採用申込みフォームより送信がありました。

■ お名前: ${name}（${kana}）
■ メールアドレス: ${email}
■ 電話番号: ${tel}
■ 希望職種: ${job}
■ 希望雇用形態: ${type}
■ 希望勤務地: ${place}
■ 歯科技工士免許: ${license || "（未選択）"}
■ 実務経験: ${exp || "（未選択）"}

■ ご質問・メッセージ:
${message || "（なし）"}

――――――――――――――――――
このメールに返信すると、応募者（${name} 様）のメールアドレス宛に返信されます。`;

    // HTML版（表形式で見やすく）
    const row = (label, value) =>
`<tr>
  <th style="text-align:left;background:#f4f7fb;color:#5a6878;font-weight:700;padding:14px 16px;width:34%;border:1px solid #e6ebf1;vertical-align:top;font-size:13px;">${label}</th>
  <td style="padding:14px 16px;color:#2d3a4a;border:1px solid #e6ebf1;vertical-align:top;font-size:14px;line-height:1.7;">${value}</td>
</tr>`;

    const html =
`<div style="background:#eef2f6;padding:24px 12px;font-family:'Hiragino Kaku Gothic ProN','Noto Sans JP',Meiryo,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6ebf1;">
    <div style="height:5px;background:linear-gradient(90deg,#18b85f,#4a90e2);"></div>
    <div style="padding:28px 30px 6px;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#2d3a4a;font-weight:700;">採用のご応募がありました</h1>
      <p style="margin:0 0 18px;font-size:13px;color:#8a96a4;line-height:1.7;">株式会社tre-foil ウェブサイトの採用申込みフォームより送信されました。</p>
    </div>
    <div style="padding:0 30px 6px;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${row("お名前", `${esc(name)}（${esc(kana)}）`)}
          ${row("メールアドレス", `<a href="mailto:${esc(email)}" style="color:#4a90e2;text-decoration:none;">${esc(email)}</a>`)}
          ${row("電話番号", esc(tel))}
          ${row("希望職種", esc(job))}
          ${row("希望雇用形態", esc(type))}
          ${row("希望勤務地", esc(place))}
          ${row("歯科技工士免許", esc(license || "（未選択）"))}
          ${row("実務経験", esc(exp || "（未選択）"))}
          ${row("ご質問・メッセージ", message ? esc(message).replace(/\n/g, "<br>") : "（なし）")}
        </tbody>
      </table>
    </div>
    <div style="padding:16px 30px 26px;">
      <p style="margin:0;font-size:12px;color:#a7b0bb;line-height:1.7;">このメールに返信すると、応募者（${esc(name)} 様）のメールアドレス宛に返信されます。</p>
    </div>
  </div>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `tre-foil 採用申込み <${from}>`,
        to: [to],
        reply_to: email,
        subject: `【tre-foil】採用申込み（${name} 様／${job}）`,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ ok: false, error: "メール送信に失敗しました。", detail }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}
