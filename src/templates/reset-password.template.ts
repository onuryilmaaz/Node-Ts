export function resetPasswordTemplate(data: { otp: string; minutes: number }) {
  return {
    subject: "Şifre sıfırlama kodunuz",
    text: `Şifrenizi sıfırlamak için kodunuz: ${data.otp}
Bu kod ${data.minutes} dakika geçerlidir.
Eğer bu isteği siz yapmadıysanız, bu emaili yok sayabilirsiniz.`,
    html: `
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
    <div style="max-width: 500px; margin: 60px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: #008080; padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">Şifre Sıfırlama</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
            <p style="margin: 0 0 25px 0; color: #333; font-size: 15px;">
                Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:
            </p>
            
            <!-- OTP Code -->
            <div style="background: #f0fafa; border: 2px solid #008080; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 25px;">
                <div style="font-size: 36px; letter-spacing: 8px; font-weight: 700; color: #008080; font-family: monospace;">
                    ${data.otp}
                </div>
            </div>
            
            <p style="margin: 0 0 15px 0; color: #333; font-size: 15px;">
                Bu kod <strong>${data.minutes} dakika</strong> geçerlidir.
            </p>
            
            <p style="margin: 0; color: #666; font-size: 14px;">
                Eğer bu isteği siz yapmadıysanız, bu e-postayı yok sayabilirsiniz.
            </p>
        </div>
        
    </div>
</body>
    `,
  };
}
