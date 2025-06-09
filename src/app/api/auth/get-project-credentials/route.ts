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

    // Get project credentials
    const { data: user, error } = await supabase
      .from("myusers")
      .select("project_url, project_key")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching project credentials:", error);
      return NextResponse.json(
        { error: "Failed to fetch project credentials" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Return project credentials
    return NextResponse.json({
      projectUrl: user.project_url,
      projectKey: user.project_key,
    });
  } catch (error) {
    console.error("Error in get-project-credentials:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
