// Cloudflare Pages Function: POST /api/contact
// お問い合わせフォームを受け取り、Resend 経由でメール送信する。
// 必要な環境変数（Cloudflare Pages の Settings → Environment variables）:
//   RESEND_API_KEY : Resend の API キー
//   CONTACT_TO     : 受信したいメールアドレス（例: kotaro.nishidome@cre-can.com）
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

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const form = await request.formData();
    const get = (k) => (form.get(k) || "").toString().trim();

    const company = get("医院名・会社名");
    const name    = get("ご担当者名");
    const email   = get("メールアドレス");
    const tel     = get("電話番号");
    const type    = get("お問い合わせ種別");
    const message = get("お問い合わせ内容");

    // サーバー側バリデーション（未入力なら送信不可）
    if (!company || !name || !email || !tel || !type || !message) {
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

    const text =
`ホームページのお問い合わせフォームから送信がありました。

■ 医院名・会社名: ${company}
■ ご担当者名: ${name}
■ メールアドレス: ${email}
■ 電話番号: ${tel}
■ お問い合わせ種別: ${type}

■ お問い合わせ内容:
${message}
`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `tre-foil お問い合わせ <${from}>`,
        to: [to],
        reply_to: email,
        subject: `【ホームページ】お問い合わせ（${name} 様）`,
        text,
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
