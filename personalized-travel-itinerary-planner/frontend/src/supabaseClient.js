import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

// True only when real-looking values were provided (not the placeholders).
export const supabaseEnabled = Boolean(
  url && key && url.startsWith("http") && !url.includes("your-project") && !key.toLowerCase().startsWith("your_")
);

// Only the public anon/publishable key is used here. Row Level Security in the
// database makes sure each user can only touch their own rows.
export const supabase = supabaseEnabled ? createClient(url, key) : null;
