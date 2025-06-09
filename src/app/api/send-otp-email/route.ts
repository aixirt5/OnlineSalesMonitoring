import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return new Response(
        JSON.stringify({ 
          error: 'Email and OTP are required',
          details: 'Missing required fields',
          received: { email: !!email, otp: !!otp }
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'Email service not configured',
          details: 'Missing RESEND_API_KEY environment variable'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { data, error } = await resend.emails.send({
      from: 'Sales Monitoring <onboarding@resend.dev>',
      to: email,
      subject: 'Your Login Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your Verification Code</h2>
          <p>Your verification code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 5px; text-align: center; padding: 20px; background: #f5f5f5;">${otp}</h1>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `
    });

    if (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email',
          details: error
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        message: 'Email sent successfully',
        id: data?.id
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 