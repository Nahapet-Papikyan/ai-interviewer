"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AssessmentStart() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/assessment/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        companyName: form.get("companyName"),
        role: form.get("role"),
        email: form.get("email"),
        language: form.get("language"),
      }),
    });
    const data = (await res.json().catch(() => null)) as { token?: string; error?: string } | null;
    setPending(false);
    if (!res.ok || !data?.token) {
      setError(data?.error || "Could not start the assessment. Please try again.");
      return;
    }
    router.push(`/i/${data.token}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[1.6rem] border border-white/10 bg-ink-2 p-6 shadow-[0_24px_80px_rgb(0_0_0_/_0.28)]"
    >
      <div className="flex h-12 items-end justify-center gap-1" aria-hidden>
        {[12, 22, 34, 20, 28, 16, 24].map((h, i) => (
          <span
            key={i}
            className="landing-wave w-1.5 rounded-full bg-gradient-to-t from-brand-3 to-brand"
            style={{ height: h }}
          />
        ))}
      </div>
      <div className="mt-6 space-y-4">
        <Field label="First name" name="firstName" autoComplete="given-name" required />
        <Field label="Company" name="companyName" autoComplete="organization" required />
        <Field label="Role" name="role" placeholder="CEO, COO, Operations…" required />
        <Field label="Work email" name="email" type="email" autoComplete="email" />
        <label className="block text-sm">
          <span className="mb-1.5 block text-mist">Language</span>
          <select
            name="language"
            defaultValue="hy"
            className="h-11 w-full rounded-xl border border-white/12 bg-ink px-3 text-cloud outline-none"
          >
            <option value="hy">Armenian</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      <button
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand text-sm font-medium text-white hover:bg-[#3b9bff] disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Starting…" : "Start Free Assessment"}
      </button>
      <p className="mt-3 text-center text-xs leading-5 text-mist">
        After you start, your browser may ask for microphone access. You can continue in text if needed.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-mist">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-white/12 bg-ink px-3 text-cloud outline-none placeholder:text-mist/50"
      />
    </label>
  );
}
