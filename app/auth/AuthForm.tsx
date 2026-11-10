"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

type Mode = "sign-in" | "sign-up";

function message(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number } | null;
  const code = (e?.code || "").toUpperCase();
  if (code.includes("INVALID_EMAIL_OR_PASSWORD") || e?.status === 401) return "E-mail ou senha incorretos.";
  if (code.includes("USER_ALREADY_EXISTS")) return "Já existe uma conta com este e-mail. Entre pela tela de login.";
  if (code.includes("PASSWORD_TOO_SHORT")) return "A senha é curta demais.";
  return e?.message || "Não foi possível concluir. Tente novamente.";
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name || email });
      if (res.error) {
        setError(message(res.error));
        return;
      }
      const me = (await fetch("/api/me", { cache: "no-store" }).then((r) => r.json())) as { allowed: boolean };
      if (!me.allowed) {
        await authClient.signOut().catch(() => {});
        setError("Este e-mail não está autorizado a acessar o CRM. Fale com a Dra. Marcelle.");
        return;
      }
      window.location.href = "/";
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>{mode === "sign-in" ? "Entrar no CRM" : "Criar acesso"}</h1>
        <p className="sub">Marcelle Rosa Advocacia · acesso restrito à equipe</p>
        {mode === "sign-up" && (
          <>
            <label htmlFor="name">Nome</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </>
        )}
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        />
        <button type="submit" disabled={busy}>
          {busy ? "Aguarde…" : mode === "sign-in" ? "Entrar" : "Criar acesso"}
        </button>
        {error && <div className="err" role="alert">{error}</div>}
        <div className="alt">
          {mode === "sign-in" ? (
            <>Primeiro acesso? <a href="/auth/sign-up">Criar acesso</a></>
          ) : (
            <>Já tem acesso? <a href="/auth/sign-in">Entrar</a></>
          )}
        </div>
      </form>
    </div>
  );
}
