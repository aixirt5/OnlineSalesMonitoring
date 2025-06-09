import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env file."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: "main-auth",
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

// Log Supabase initialization in development
if (process.env.NODE_ENV === "development") {
  console.log("Supabase client initialized with URL:", supabaseUrl);
}
