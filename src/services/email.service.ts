import { transporter } from "./nodemailer.client";

function getEmailFrom(): string {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is missing");
  return from;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  // if (process.env.NODE_ENV !== "production") {
  //   console.log("OTP EMAIL (DEV MODE)");
  //   return;
  // }

  const from = getEmailFrom();

  try {
    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch (err) {
    console.log("NODEMAILER_ERROR:", err);
    throw new Error("EMAIL_SEND_FAILED");
  }
}
