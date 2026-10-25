import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("WP-10: Build & AWS Deployment Hardening Verification", () => {
  const rootDir = path.resolve(__dirname, "../../../../");
  const serverDir = path.resolve(rootDir, "server");
  const clientDir = path.resolve(rootDir, "client");

  describe("1. Server Dockerfile Hardening", () => {
    const serverDockerfile = fs.readFileSync(path.join(serverDir, "Dockerfile"), "utf8");

    it("enforces multi-stage build pattern with builder and runner", () => {
      expect(serverDockerfile).toMatch(/FROM\s+node:20-alpine\s+AS\s+builder/i);
      expect(serverDockerfile).toMatch(/FROM\s+node:20-alpine\s+AS\s+runner/i);
    });

    it("runs as non-root user (expressjs:nodejs)", () => {
      expect(serverDockerfile).toMatch(/addgroup\s+--system\s+--gid\s+1001\s+nodejs/);
      expect(serverDockerfile).toMatch(/adduser\s+--system\s+--uid\s+1001\s+expressjs/);
      expect(serverDockerfile).toMatch(/USER\s+expressjs/);
    });

    it("copies compiled artifacts with explicit non-root chown permissions", () => {
      expect(serverDockerfile).toMatch(/--chown=expressjs:nodejs\s+\/app\/dist\s+\.\/dist/);
    });

    it("defines an automated container healthcheck", () => {
      expect(serverDockerfile).toMatch(/HEALTHCHECK\s+--interval=30s/);
      expect(serverDockerfile).toContain("/api/health/liveness");
    });
  });

  describe("2. Client Dockerfile Hardening", () => {
    const clientDockerfile = fs.readFileSync(path.join(clientDir, "Dockerfile"), "utf8");

    it("enforces multi-stage build pattern with standalone optimization", () => {
      expect(clientDockerfile).toMatch(/FROM\s+base\s+AS\s+deps/i);
      expect(clientDockerfile).toMatch(/FROM\s+base\s+AS\s+builder/i);
      expect(clientDockerfile).toMatch(/FROM\s+base\s+AS\s+runner/i);
      expect(clientDockerfile).toMatch(/\.next\/standalone/);
    });

    it("runs as non-root user (nextjs:nodejs)", () => {
      expect(clientDockerfile).toMatch(/addgroup\s+--system\s+--gid\s+1001\s+nodejs/);
      expect(clientDockerfile).toMatch(/adduser\s+--system\s+--uid\s+1001\s+nextjs/);
      expect(clientDockerfile).toMatch(/USER\s+nextjs/);
    });

    it("defines an automated container healthcheck", () => {
      expect(clientDockerfile).toMatch(/HEALTHCHECK\s+--interval=30s/);
      expect(clientDockerfile).toContain("http://localhost:3000/");
    });
  });

  describe("3. Docker Ignore & Secret Isolation", () => {
    const rootDockerignore = fs.readFileSync(path.join(rootDir, ".dockerignore"), "utf8");
    const serverDockerignore = fs.readFileSync(path.join(serverDir, ".dockerignore"), "utf8");
    const clientDockerignore = fs.readFileSync(path.join(clientDir, ".dockerignore"), "utf8");

    it("strictly excludes credentials, keys, tarballs, and .env files from images", () => {
      for (const ignoreContent of [rootDockerignore, serverDockerignore, clientDockerignore]) {
        expect(ignoreContent).toMatch(/\.env\*/);
        expect(ignoreContent).toMatch(/\*\.pem/);
        expect(ignoreContent).toMatch(/\*\.key/);
        expect(ignoreContent).toMatch(/keys/);
      }
      expect(rootDockerignore).toMatch(/\*\.tar\.gz/);
    });
  });

  describe("4. Docker Compose Production Configuration", () => {
    const composeContent = fs.readFileSync(path.join(rootDir, "docker-compose.yml"), "utf8");

    it("does not contain an insecure hardcoded fallback for JWT_SECRET", () => {
      expect(composeContent).toMatch(/JWT_SECRET:\s+\$\{JWT_SECRET\}/);
      expect(composeContent).not.toMatch(/JWT_SECRET:\s+\$\{JWT_SECRET:-workpilot/);
    });

    it("enforces memory bounds and log rotation", () => {
      expect(composeContent).toMatch(/--max-old-space-size=384/);
      expect(composeContent).toMatch(/--max-old-space-size=400/);
      expect(composeContent).toMatch(/max-size:\s+"10m"/);
      expect(composeContent).toMatch(/max-file:\s+"3"/);
    });
  });

  describe("5. AWS EC2 Deployment Script (deploy-production.sh)", () => {
    const deployScript = fs.readFileSync(path.join(rootDir, "scripts", "deploy-production.sh"), "utf8");

    it("fails closed on any unhandled error or unset variable", () => {
      expect(deployScript).toMatch(/set\s+-euo\s+pipefail/);
    });

    it("guards against execution as root by delegating to user ubuntu", () => {
      expect(deployScript).toMatch(/if\s+\[\s*"\$\(id\s+-u\)"\s+-eq\s+0\s*\]/);
      expect(deployScript).toMatch(/sudo\s+-iu\s+ubuntu/);
    });

    it("synchronizes deterministically to target commit and writes version stamp", () => {
      expect(deployScript).toMatch(/git\s+reset\s+--hard\s+"\$\{TARGET_COMMIT\}"/);
      expect(deployScript).toMatch(/echo\s+"\$\{NEW_COMMIT\}"\s+>\s+\.deploy-version/);
    });

    it("executes post-deployment health probes for backend and frontend", () => {
      expect(deployScript).toMatch(/BACKEND_LIVENESS_URL="http:\/\/127\.0\.0\.1:4000\/api\/health\/liveness"/);
      expect(deployScript).toMatch(/FRONTEND_HEALTH_URL="http:\/\/127\.0\.0\.1:3000\/"/);
    });
  });

  describe("6. CI/CD Pipeline (deploy-production.yml)", () => {
    const workflowContent = fs.readFileSync(
      path.join(rootDir, ".github", "workflows", "deploy-production.yml"),
      "utf8",
    );

    it("enforces single concurrent deployment group to prevent split-brain releases", () => {
      expect(workflowContent).toMatch(/concurrency:\s*\n\s*group:\s*production-deployment\s*\n\s*cancel-in-progress:\s*false/);
    });

    it("requires automated secret scan and configuration validation before deployment", () => {
      expect(workflowContent).toMatch(/run:\s*node\s+scripts\/scan-secrets\.mjs/);
      expect(workflowContent).toMatch(/run:\s*node\s+scripts\/test-secret-scanner\.mjs/);
      expect(workflowContent).toMatch(/run:\s*node\s+scripts\/test-config-validation\.mjs/);
    });

    it("uses GitHub OIDC authentication for AWS without static credentials", () => {
      expect(workflowContent).toMatch(/id-token:\s*write/);
      expect(workflowContent).toMatch(/audience:\s*sts\.amazonaws\.com/);
      expect(workflowContent).toMatch(/aws-actions\/configure-aws-credentials@v5/);
    });
  });
});
