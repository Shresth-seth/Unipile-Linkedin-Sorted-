import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import RegisterForm from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create your account — WORKPILOT",
  description: "Start building intelligent LinkedIn outreach campaigns safely.",
};

export default function RegisterPage() {
  return (
    <AuthShell type="register">
      <RegisterForm />
    </AuthShell>
  );
}
