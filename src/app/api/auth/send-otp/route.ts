import { NextResponse } from "next/server";
import { generateOTP, sendOTP } from "@/lib/server/email";
import { storeOTP } from "@/utils/otp";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json();

    console.log("Generating OTP for:", { userId, email });

    // Generate OTP
    const otp = generateOTP();

    // Store OTP first
    try {
      await storeOTP(userId, otp);
    } catch (error) {
      console.error("Failed to store OTP:", error);
      return NextResponse.json(
        { error: "Failed to store OTP" },
        { status: 500 }
      );
    }

    // Send OTP via email
    try {
      await sendOTP(email, otp);
    } catch (error) {
      console.error("Failed to send OTP email:", error);
      // If email fails, delete the stored OTP
      await supabase.from("user_otps").delete().eq("user_id", userId);

      return NextResponse.json(
        { error: "Failed to send OTP email" },
        { status: 500 }
      );
    }

    console.log("Successfully sent OTP to:", email);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in send-otp route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
