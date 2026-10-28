"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = ComponentProps<"input">;

/**
 * Password field with a show/hide control.
 *
 * The toggle stays outside the input so password managers and native
 * autofill keep working. Its label and pressed state expose visibility to
 * assistive technology, and `aria-controls` ties it to the input.
 */
function PasswordInput({
  className,
  disabled,
  id,
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        disabled={disabled}
        {...props}
        type={isVisible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        disabled={disabled}
        aria-controls={id}
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((visible) => !visible)}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        {isVisible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
