import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://wzobuuobcrpjpfmvzpbr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6b2J1dW9iY3JwanBmbXZ6cGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTc3MjksImV4cCI6MjA5MjQ3MzcyOX0.TXBFmXjxhVAHdkh0FKMfX5uX_sYRSpQf4HzsjlS2YTM"
);

console.log("supabase client:", supabase);