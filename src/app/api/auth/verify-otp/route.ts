import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { userId, otp } = await request.json();

    if (!userId || !otp) {
      return new Response(
        JSON.stringify({ error: 'User ID and OTP are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get stored OTP
    const { data: otpData, error: otpError } = await supabase
      .from("user_otps")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (otpError) {
      return new Response(
        JSON.stringify({ error: 'Failed to verify OTP' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!otpData) {
      return new Response(
        JSON.stringify({ error: 'No OTP found for this user' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if OTP has expired
    const expiresAt = new Date(otpData.expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ error: 'OTP has expired' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete used OTP
    await supabase
      .from("user_otps")
      .delete()
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({ message: 'OTP verified successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to verify OTP' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Helper function to store OTP in Supabase
export async function storeOTP(userId: number, otp: string) {
  try {
    // Delete any existing OTP for this user
    await supabase
      .from("user_otps")
      .delete()
      .eq("user_id", userId);

    // Calculate expiry time (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Store new OTP
    const { error: insertError } = await supabase.from("user_otps").insert({
      user_id: userId,
      otp: otp,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      throw insertError;
    }
  } catch (error) {
    throw error;
  }
}
