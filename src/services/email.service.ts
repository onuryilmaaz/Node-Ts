import { resend } from "./resend.client";

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
  const from = getEmailFrom();
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    console.log("RESEND_ERROR:", error);
    throw new Error("EMAIL_SEND_FAILED");
  }

  return data;
}
