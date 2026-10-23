# WORKPILOT Production Launch Checklist

This checklist is a release gate. Do not deploy the current SaaS build until every required item is complete.

## 1. Required secrets

Generate independent, high-entropy values and store them in the production secret manager. Never commit them.

- `JWT_SECRET`: at least 32 characters.
- `DATA_ENCRYPTION_KEY`: at least 32 characters and different from `JWT_SECRET`.
- `UNIPILE_WEBHOOK_SECRET`: at least 32 characters; configure the same value in Unipile.
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`: Razorpay live-mode credentials.
- `RAZORPAY_WEBHOOK_SECRET`: at least 32 characters; configure the same value in Razorpay.
- `RESEND_API_KEY`: production transactional-email credential.
- `EMAIL_FROM`: sender on a domain verified by the email provider.
- `SUPPORT_EMAIL`: monitored support inbox.

The API intentionally refuses to start in production when these values are missing.

## 2. Razorpay subscriptions

Create two live Pro plans matching the public pricing page and add their IDs to the environment. Team deployments are quoted and onboarded manually until shared workspace features are implemented:

| Environment variable | Frequency | Amount |
| --- | --- | ---: |
| `RAZORPAY_PLAN_PRO_MONTHLY` | Monthly | INR 3,499 |
| `RAZORPAY_PLAN_PRO_YEARLY` | Yearly | INR 33,588 |
Configure `https://linkdin.workpilot.co.in/api/billing/webhook` and enable subscription activation, charge, pending, halted, resumed, cancelled, completed, and expired events. Use separate test-mode and live-mode secrets.

Complete at least one test-mode purchase, renewal event, failed-payment event, and cancellation before enabling live keys.

## 3. Transactional email

- Verify the sending domain with Resend.
- Confirm SPF and DKIM pass.
- Test email verification, expired verification links, password reset, expired reset links, and contact-form delivery.
- Ensure replies and support requests reach a monitored mailbox.

## 4. Database and recovery

- Take a database snapshot before deployment.
- Run `npm run db:migrate:prod` and `npm run db:custom-migrate:prod`.
- Confirm `/api/health/readiness` returns HTTP 200.
- Verify automated daily backups and perform a restore drill in staging.
- Confirm action-queue jobs recover after an interrupted worker and are not executed twice.

## 5. Release verification

Run from a clean checkout:

```text
cd server && npm ci && npm run typecheck && npm run build && npm run test:saas
cd client && npm ci && npm run lint && npm run typecheck && npm run build
```

Then verify signup, verification, login, password reset, LinkedIn connection, Starter limits, Pro checkout, webhook activation, cancellation, contact delivery, account deletion, and mobile layouts in staging.

## 6. Business and compliance

- Have qualified counsel review the Terms and Privacy Policy for the operating legal entity and customer jurisdictions.
- Publish the legal entity name, registered address, support address, refund policy, tax treatment, and grievance contact required by applicable law.
- Document subprocessors and data-retention periods.
- Make the risk of LinkedIn account restrictions clear during onboarding. Pacing controls reduce activity spikes but cannot guarantee account safety or platform approval.
- Establish an incident-response owner, support response targets, and a status communication process.
