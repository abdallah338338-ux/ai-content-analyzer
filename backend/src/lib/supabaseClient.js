import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client = null;

if (supabaseUrl && supabaseKey) {
  client = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. Database persistence will be bypassed locally.");
  client = {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: null,
            error: { message: "Supabase credentials not configured locally." },
          }),
        }),
      }),
    }),
  };
}

export const supabase = client;
