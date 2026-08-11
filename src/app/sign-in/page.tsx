/**
 * Sign-in route (Phase 6.6, design.md "File Changes"). Minimal shell —
 * this story owns sign-in only, no app shell (out of scope per the
 * proposal's "Out of Scope": "app shell (1.5)").
 */
import { SignInForm } from "@/modules/auth/ui/sign-in-form";

export default function SignInPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-xl font-semibold">Sign in</h1>
        <SignInForm />
      </div>
    </div>
  );
}
