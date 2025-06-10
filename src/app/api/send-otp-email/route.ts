import { Resend } from 'resend';

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: Request) {
  console.log('Received email send request');
  
  try {
    const body = await request.json();
    console.log('Request body:', { 
      email: body.email,
      otp: body.otp ? '✓ Set' : '✗ Missing'
    });

    const { email, otp } = body;

    if (!email || !otp) {
      const error = 'Email and OTP are required';
      console.error(error);
      return new Response(
        JSON.stringify({ 
          error, 
          details: 'Missing required fields',
          received: { email: !!email, otp: !!otp }
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!resend) {
      console.error('Resend API key not configured');
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

    try {
      console.log('Sending email to:', email);
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
        console.error('Resend API error:', error);
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

      console.log('Email sent successfully:', data);
      
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
    } catch (emailError: Error | unknown) {
      console.error('Email sending error:', emailError);

      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email',
          details: emailError instanceof Error ? emailError.message : String(emailError)
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('API route error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 