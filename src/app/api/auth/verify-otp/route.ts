import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const req = await request.json();
    const { userId, otp, deviceInfo } = req;

    // Verify OTP
    const { data: otpRecord, error: otpError } = await supabase
      .from("user_otps")
      .select("*")
      .eq("user_id", userId)
      .eq("otp", otp)
      .single();

    if (otpError || !otpRecord) {
      return NextResponse.json(
        { error: "Invalid OTP number" },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "OTP has expired" },
        { status: 400 }
      );
    }

    // Get current verified devices
    const { data: user } = await supabase
      .from("myusers")
      .select("verified_devices")
      .eq("id", userId)
      .single();

    const verifiedDevices = (user?.verified_devices || []) as Array<{
      userAgent: string;
      ipAddress: string;
    }>;

    // Add new device if it doesn't exist
    if (
      !verifiedDevices.some(
        (device) => device.userAgent === deviceInfo.userAgent
      )
    ) {
      verifiedDevices.push({
        userAgent: deviceInfo.userAgent,
        ipAddress: "stored",
      });

      const { error: updateError } = await supabase
        .from("myusers")
        .update({ verified_devices: verifiedDevices })
        .eq("id", userId);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to verify device" },
          { status: 500 }
        );
      }
    }

    // Delete used OTP
    await supabase
      .from("user_otps")
      .delete()
      .eq("user_id", userId)
      .eq("otp", otp);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { error: "Invalid OTP number" },
      { status: 400 }
    );
  }
}
