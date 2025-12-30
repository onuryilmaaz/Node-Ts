import axios from "axios";

const BREVO_API_KEY = process.env.BREVO_API_KEY;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "My App",
          email: "no-reply@brevo.com",
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("BREVO_API_ERROR:", err.response?.data || err.message);
    throw new Error("EMAIL_SEND_FAILED");
  }
}
