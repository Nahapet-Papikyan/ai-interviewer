"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const search = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: form.get("password") }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Invalid password");
      return;
    }
    window.location.href = search.get("next") || "/dashboard";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-xl font-semibold">Admin login</h1>
      <p className="mt-2 text-sm text-zinc-500">Internal discovery dashboard. Single shared password for MVP.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoFocus />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="btn w-full" disabled={pending} type="submit">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
