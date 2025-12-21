export function changeEmailTemplate(params: { otp: string; minutes: number }) {
  const { otp, minutes } = params;
  return {
    subject: "Email değişikliği doğrulama kodunuz",
    text: `Hesabınızdaki email adresini değiştirmek için doğrulama kodunuz: ${otp}
Bu kod ${minutes} dakika boyunca geçerlidir.
Eğer bu işlemi siz başlatmadıysanız, lütfen bu emaili dikkate almayın.`,
    html: `
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
    <div style="max-width: 500px; margin: 60px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: #008080; padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">Email Değişikliği</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
            <p style="margin: 0 0 25px 0; color: #333; font-size: 15px;">
                Hesabınızdaki email adresini değiştirmek için doğrulama kodunuz:
            </p>
            
            <!-- OTP Code -->
            <div style="background: #f0fafa; border: 2px solid #008080; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 25px;">
                <div style="font-size: 36px; letter-spacing: 8px; font-weight: 700; color: #008080; font-family: monospace;">
                    ${otp}
                </div>
            </div>
            
            <p style="margin: 0 0 15px 0; color: #333; font-size: 15px;">
                Bu kod <strong>${minutes} dakika</strong> boyunca geçerlidir.
            </p>
            
            <p style="margin: 0; color: #666; font-size: 14px;">
                Eğer bu işlemi siz başlatmadıysanız, lütfen bu e-postayı dikkate almayın.
            </p>
        </div>
        
    </div>
</body>
    `,
  };
}
