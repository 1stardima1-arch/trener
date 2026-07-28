// Auth.js's built-in email template is generic ("Sign in to {host}", plain
// black-and-white). This mirrors the app's actual dark/gradient look so the
// email doesn't feel like a different, less trustworthy product.
export function verificationEmailHtml(url: string) {
  return `
<body style="margin:0;padding:32px 16px;background:#f4f3f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:420px;margin:0 auto;border-radius:28px;overflow:hidden;background:linear-gradient(165deg,#101019 0%,#0b0b14 60%,#0d0c18 100%);padding:40px 32px;text-align:center;">
    <div style="width:56px;height:56px;margin:0 auto 20px;border-radius:50%;background:conic-gradient(from 180deg,#5a8dff,#b06bff,#ff6b9d,#5a8dff);"></div>
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.01em;">Тренер</div>
    <p style="margin:20px 0 28px;color:rgba(255,255,255,0.75);font-size:15px;line-height:1.5;">
      Нажми на кнопку ниже, чтобы войти. Ссылка действует 24 часа и работает один раз.
    </p>
    <a href="${url}" style="display:inline-block;padding:14px 32px;border-radius:999px;background:#fff;color:#101019;font-weight:700;font-size:15px;text-decoration:none;">
      Войти в Тренер
    </a>
    <p style="margin:28px 0 0;color:rgba(255,255,255,0.35);font-size:12px;">
      Если это не вы — просто проигнорируйте это письмо.
    </p>
  </div>
</body>`;
}

export function verificationEmailText(url: string) {
  return `Войти в Тренер: ${url}\n\nСсылка действует 24 часа. Если это не вы — проигнорируйте это письмо.`;
}
