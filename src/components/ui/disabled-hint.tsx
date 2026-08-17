"use client";

/**
 * Generic "visibly disabled with a stated reason" wrapper (Story 1.3 Task 4,
 * AC 5). RBAC — and any other permission rule — must be visible, not silent
 * (EXPERIENCE.md Accessibility Floor). Role-agnostic, presentation-only
 * infrastructure: no `UserRole` import, no auth-module coupling. Any future
 * module (Epic 7's "Validar" gate, etc.) reuses this exact primitive.
 *
 * When `disabled` is true, the wrapped control renders with the native
 * `disabled` attribute PLUS a visible, adjacent reason string (an actual
 * rendered `<span>`, never a `title` attribute alone), linked via
 * `aria-describedby` (via `useId()`) so screen readers announce the reason
 * too. When `disabled` is false, the child renders untouched.
 */
import { cloneElement, isValidElement, useId, type ReactElement } from "react";
import { cn } from "@/lib/utils";

type DisableableElement = ReactElement<{
  disabled?: boolean;
  "aria-describedby"?: string;
}>;

export interface DisabledHintProps {
  /** Whether the wrapped control should render disabled with its reason. */
  disabled: boolean;
  /** Visible, human-readable explanation for why the control is disabled. */
  reason: string;
  /** The control to wrap — must accept `disabled`/`aria-describedby` props. */
  children: DisableableElement;
  className?: string;
}

export function DisabledHint({
  disabled,
  reason,
  children,
  className,
}: DisabledHintProps) {
  const reasonId = useId();

  if (!disabled) return children;

  const control = isValidElement(children)
    ? cloneElement(children, { disabled: true, "aria-describedby": reasonId })
    : children;

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      {control}
      <span id={reasonId} className="text-xs text-muted-foreground">
        {reason}
      </span>
    </span>
  );
}
