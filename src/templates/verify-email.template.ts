export function verifyEmailTemplate(params: { otp: string; minutes: number }) {
  const { otp, minutes } = params;

  return {
    subject: "Email doğrulama kodunuz",
    text: `Doğrulama kodunuz: ${otp}\nKod ${minutes} dakika içinde geçersiz olur.`,
    html: `
      <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
    <div style="max-width: 500px; margin: 60px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
        <div style="background: #008080; padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">Email Doğrulama</h1>
        </div>
        <div style="padding: 40px 30px;">
            <p style="margin: 0 0 25px 0; color: #333; font-size: 15px;">
                Doğrulama kodunuz:
            </p>
            <div style="background: #f0fafa; border: 2px solid #008080; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 25px;">
                <div style="font-size: 36px; letter-spacing: 8px; font-weight: 700; color: #008080; font-family: monospace;">
                    ${otp}
                </div>
            </div>
            <p style="margin: 0 0 15px 0; color: #333; font-size: 15px;">
                Bu kod <strong>${minutes}  dakika</strong> içinde geçersiz olur.
            </p>
            <p style="margin: 0; color: #666; font-size: 14px;">
                Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.
            </p>
        </div>
    </div>
</body>
    `,
  };
}
