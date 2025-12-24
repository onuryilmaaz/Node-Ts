import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!host || !port || !user || !pass) {
  throw new Error("SMTP config is missing");
}

export const transporter = nodemailer.createTransport({
  host,
  port: Number(port),
  secure: Number(port) === 465, // 465 = true, 587 = false
  auth: {
    user,
    pass,
  },
});
