"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, FormField, TextInput } from "@/components/shared";
import { BrandLogo } from "@/components/brand/Logo";
import { SITE_NAME } from "@/lib/site";

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
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgb(22_135_248_/_0.18),transparent_60%)]"
      />
      <div className="relative">
        <BrandLogo size={56} priority className="mb-5" />
        <p className="text-[11px] font-semibold tracking-[0.16em] text-brand uppercase">{SITE_NAME}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-cloud">Admin login</h1>
        <p className="mt-2 text-sm leading-6 text-mist">Internal discovery dashboard.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <FormField label="Password" htmlFor="password" labelClassName="text-mist">
            <TextInput
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="border-white/10 bg-white/5 text-cloud placeholder:text-mist/50"
            />
          </FormField>
          {error ? (
            <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button className="h-11 w-full" disabled={pending} type="submit">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
