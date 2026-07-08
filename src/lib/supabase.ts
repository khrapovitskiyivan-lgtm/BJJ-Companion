// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL=https://vudxcyudgcsjyifsgceb.supabase.co/rest/v1/;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1ZHhjeXVkZ2NzanlpZnNnY2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDY0NDAsImV4cCI6MjA5OTA4MjQ0MH0.Zjt1-zEpZnTEIzFYJJBpVM8J0SdXkcPu0Oepf4JV6O0;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase не настроен. Добавь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env.local");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);
