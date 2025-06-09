import nodemailer from "nodemailer";

// Function to generate a random 6-digit OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Function to send OTP via email
export async function sendOTP(
  recipientEmail: string,
  otp: string
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // The system's email address (SMTP_FROM) will be the sender
  await transporter.sendMail({
    from: `"Online Sales System" <${process.env.SMTP_FROM}>`,
    to: recipientEmail, // The user's contact_email from the database
    subject: "Your OTP Code for Login",
    text: `Your OTP code is: ${otp}. This code will expire in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0369a1;">Your OTP Code for Login</h2>
        <p style="font-size: 16px; color: #334155;">Your OTP code is:</p>
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #0369a1; letter-spacing: 4px;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #64748b;">This code will expire in 5 minutes.</p>
        <p style="font-size: 14px; color: #64748b;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  });
}
