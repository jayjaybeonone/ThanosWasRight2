"use strict";

// Sends transactional email through Resend (https://resend.com) when RESEND_API_KEY is set.
// Without a key, emails are logged instead, so local development works with no account.
// Email failures are logged and never fail the booking itself.

async function sendEmail({ to, subject, text }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!key || !from) {
    console.log(`[email skipped: no RESEND_API_KEY/EMAIL_FROM] to=${to} subject="${subject}"`);
    return { sent: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      console.error(`[email failed] status=${res.status} to=${to}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[email error] to=${to}: ${err.message}`);
    return { sent: false };
  }
}

module.exports = { sendEmail };
