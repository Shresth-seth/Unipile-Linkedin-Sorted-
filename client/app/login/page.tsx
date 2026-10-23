import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import LoginForm from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log In — WORKPILOT",
  description: "Access your WORKPILOT outreach workspace.",
};

export default function LoginPage() {
  return (
    <AuthShell type="login">
      <LoginForm />
    </AuthShell>
  );
}
