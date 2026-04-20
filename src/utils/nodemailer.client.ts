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
  secure: false,
  auth: {
    user,
    pass,
  },
  tls: {
    rejectUnauthorized: false,
  },
});
