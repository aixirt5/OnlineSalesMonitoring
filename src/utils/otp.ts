import { supabase } from "@/lib/supabase";

export async function storeOTP(userId: number, otp: string) {
  try {
    // Delete any existing OTP for this user
    const { error: deleteError } = await supabase
      .from("user_otps")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting existing OTP:", deleteError);
      throw deleteError;
    }

    // Calculate expiry time (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    console.log("Storing new OTP:", {
      userId,
      otp,
      expiresAt: expiresAt.toISOString(),
    });

    // Store new OTP
    const { error: insertError } = await supabase.from("user_otps").insert({
      user_id: userId,
      otp: otp,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      throw insertError;
    }
  } catch (err) {
    console.error("Failed to store OTP:", err);
    throw err;
  }
} 