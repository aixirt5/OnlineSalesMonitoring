import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Clear verified devices array
    const { error } = await supabase
      .from("myusers")
      .update({ verified_devices: [] })
      .eq("id", userId);

    if (error) {
      console.error("Error clearing verified devices:", error);
      return NextResponse.json(
        { error: "Failed to clear verified devices" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 