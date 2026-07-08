// src/components/AuthModal.tsx
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { X } from "lucide-react";

export function AuthModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("✅ Регистрация успешна! Теперь войди в аккаунт.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
        window.location.reload();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-bold">
          {mode === "login" ? "Вход в аккаунт" : "Регистрация"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Синхронизируй прогресс между устройствами
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="font-medium text-primary hover:underline"
          >
            {mode === "login" ? "Зарегистрируйся" : "Войди"}
          </button>
        </div>
      </div>
    </div>
  );
}
