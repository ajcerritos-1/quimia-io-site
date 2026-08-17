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
 *
 * If the wrapped child already carries its own `aria-describedby` (e.g. a
 * form field also linked to a validation-error message), that id is MERGED
 * with the new reason id rather than overwritten (Review Findings patch
 * 2026-08-17) — today's two call sites never pass a child with a
 * pre-existing `aria-describedby`, so this was previously a silent
 * correctness gap waiting for the next reuse, not an active bug.
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

  const existingDescribedBy = isValidElement(children)
    ? children.props["aria-describedby"]
    : undefined;
  const describedBy = [existingDescribedBy, reasonId].filter(Boolean).join(" ");

  const control = isValidElement(children)
    ? cloneElement(children, { disabled: true, "aria-describedby": describedBy })
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
