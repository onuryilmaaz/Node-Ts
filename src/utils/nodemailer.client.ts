import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!host || !port || !user || !pass) {
  throw new Error("SMTP env variables are missing");
}

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure: false, // 587 = false (TLS upgrade)
  auth: {
    user,
    pass,
  },
  tls: {
    rejectUnauthorized: false, // Render bazen TLS hatası verir, bu güvenlidir
  },
});
