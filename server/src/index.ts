import app from "./app.js";
import http from "http";
import { actionQueueService } from "./services/queue/queue.service.js";
import { unipileClient } from "./services/unipile/unipile.client.js";
import { initAgentMessagesTable } from "./services/agent/agent-memory.service.js";
import { messageAgentWorker } from "./services/webhook/message-agent.worker.js";
import { inboundSyncService } from "./services/linkedin/inbound-sync.service.js";
import { validateProductionConfig } from "./config/production.config.js";

const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 4000;

const startServer = async () => {
  try {
    validateProductionConfig();
    // Ensure agent_messages table exists in PostgreSQL database
    await initAgentMessagesTable().catch((err) => {
      console.warn("⚠️ [STARTUP DB] agent_messages table init warning:", err?.message);
    });

    // Pre-warm dynamic Unipile credentials from system_settings table
    await unipileClient.getActiveCredentials().catch(() => {});

    server.listen(PORT, "0.0.0.0", () => {
      console.log(
        `🚀 WorkPilot Server running on http://0.0.0.0:${PORT} [${process.env.NODE_ENV || "development"}]`,
      );
    });

    const queueWorkerInterval = setInterval(async () => {
      try {
        await actionQueueService.processDueActions();
      } catch (workerErr: any) {
        console.warn("⚠️ [QUEUE WORKER WARN]", workerErr?.message || workerErr);
      }
    }, 30000);

    // Periodic check for pending inbound LinkedIn message jobs (every 30s)
    const messageWorkerInterval = setInterval(async () => {
      try {
        await messageAgentWorker.processPendingJobs();
      } catch (msgErr: any) {
        console.warn("⚠️ [MESSAGE WORKER WARN]", msgErr?.message || msgErr);
      }
    }, 30000);

    // Live LinkedIn polling sync worker (every 30s)
    inboundSyncService.startPolling(30000);

    const gracefulShutdown = (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      clearInterval(queueWorkerInterval);
      clearInterval(messageWorkerInterval);
      inboundSyncService.stopPolling();

      server.close((err) => {
        if (err) {
          console.error("Error during server close:", err);
          process.exit(1);
        }
        console.log("✅ HTTP server closed. Process exiting cleanly.");
        process.exit(0);
      });

      setTimeout(() => {
        console.error("⚠️ Forced shutdown after 10s timeout.");
        process.exit(1);
      }, 10000).unref();
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error: any) {
    console.error("Fatal startup error:", error);
    process.exit(1);
  }
};

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection detected:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception detected:", err);
});

startServer();
