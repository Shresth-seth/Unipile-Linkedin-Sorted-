export interface DailySchedulerTelemetry {
  lastSchedulerTick: Date | null;
  lastDueCount: number;
  numberRunning: number;
  lastSuccessfulRun: Date | null;
  lastFailedRun: Date | null;
}

export class DailyAgentWorker {
  private telemetry: DailySchedulerTelemetry = {
    lastSchedulerTick: null,
    lastDueCount: 0,
    numberRunning: 0,
    lastSuccessfulRun: null,
    lastFailedRun: null,
  };

  public getTelemetry(): DailySchedulerTelemetry {
    return { ...this.telemetry };
  }

  /**
   * Scans for due users.
   * PERMANENTLY DISABLED: The 4:00 AM daily automatic connection-request system has been removed
   * in favor of user-created campaigns and manually requested LinkedIn agent connection tools.
   */
  public async processDueUsers(): Promise<{ checkedCount: number; executedCount: number }> {
    // Permanently disabled: zero unsolicited daily connections.
    return { checkedCount: 0, executedCount: 0 };
  }
}

export const dailyAgentWorker = new DailyAgentWorker();
