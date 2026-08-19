"use client";

import { useFormStatus } from "react-dom";
import { Button as UiButton } from "@/components/ui/button";
import { Spinner } from "@/components/shared/spinner";
import { cn } from "@/lib/utils";

export function PendingButton({
  children,
  loadingText,
  className,
  size = "lg",
  disabled,
  ...props
}: React.ComponentProps<typeof UiButton> & { loadingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <UiButton
      size={size}
      className={cn("rounded-full px-4", className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <Spinner /> : null}
      {pending && loadingText ? loadingText : children}
    </UiButton>
  );
}
