// Follow this setup guide to integrate the Deno runtime and Supabase Functions in your project:
// https://supabase.com/docs/guides/functions/quickstart

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore: Deno imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore: Deno imports
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  email: string;
  otp: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, otp } = await req.json() as RequestBody

    if (!email || !otp) {
      throw new Error('Email and OTP are required')
    }

    // Configure SMTP client (using Gmail SMTP)
    const client = new SmtpClient()
    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: Deno.env.get('SMTP_USERNAME'),
      password: Deno.env.get('SMTP_PASSWORD'),
    })

    // Send email
    await client.send({
      from: Deno.env.get('SMTP_USERNAME')!,
      to: email,
      subject: "Your Login Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your Verification Code</h2>
          <p>Your verification code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 5px; text-align: center; padding: 20px; background: #f5f5f5;">${otp}</h1>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    })

    await client.close()

    return new Response(
      JSON.stringify({ message: 'OTP email sent successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: unknown) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
}) 