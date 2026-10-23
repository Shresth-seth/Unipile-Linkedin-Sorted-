const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

class EmailService {
  private async send(to: string, subject: string, html: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    if (!apiKey || !from) {
      if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
      console.log(`[DEV EMAIL] ${subject} -> ${to}`);
      return;
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!response.ok) throw new Error("Email delivery failed.");
  }

  async sendVerification(to: string, name: string, token: string): Promise<void> {
    const base = process.env.CLIENT_URL!.split(",")[0]!.replace(/\/+$/, "");
    const url = `${base}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send(to, "Verify your WORKPILOT email", `<h2>Welcome to WORKPILOT</h2><p>Hi ${escapeHtml(name)}, verify your email to activate your workspace.</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`);
  }

  async sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    const base = process.env.CLIENT_URL!.split(",")[0]!.replace(/\/+$/, "");
    const url = `${base}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send(to, "Reset your WORKPILOT password", `<h2>Password reset</h2><p>Hi ${escapeHtml(name)}, use the link below to choose a new password.</p><p><a href="${url}">Reset password</a></p><p>This link expires in one hour. Ignore this email if you did not request it.</p>`);
  }

  async sendContactMessage(input: { name: string; email: string; company?: string; topic: string; message: string }): Promise<void> {
    const supportEmail = process.env.SUPPORT_EMAIL?.trim();
    if (!supportEmail) throw new Error("Support inbox is not configured.");
    await this.send(supportEmail, `[WORKPILOT Contact] ${input.topic}`, `<h2>New website enquiry</h2><p><strong>Name:</strong> ${escapeHtml(input.name)}</p><p><strong>Email:</strong> ${escapeHtml(input.email)}</p><p><strong>Company:</strong> ${escapeHtml(input.company || "Not provided")}</p><p><strong>Topic:</strong> ${escapeHtml(input.topic)}</p><p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>`);
  }
}

export const emailService = new EmailService();
