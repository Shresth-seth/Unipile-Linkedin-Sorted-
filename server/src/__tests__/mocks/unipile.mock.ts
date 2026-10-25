export interface SyntheticUnipileAccount {
  id: string;
  name: string;
  status: "OK" | "CHECKPOINT" | "DISCONNECTED";
  type: string;
  checkpointType?: string;
}

export class MockUnipileClient {
  public calls: Array<{ method: string; args: any[] }> = [];

  public accounts: Map<string, SyntheticUnipileAccount> = new Map([
    [
      "unipile-acc-tenant-a",
      {
        id: "unipile-acc-tenant-a",
        name: "Tenant A LinkedIn",
        status: "CHECKPOINT",
        type: "LINKEDIN",
        checkpointType: "2FA",
      },
    ],
    [
      "unipile-acc-tenant-b",
      {
        id: "unipile-acc-tenant-b",
        name: "Tenant B LinkedIn",
        status: "OK",
        type: "LINKEDIN",
      },
    ],
  ]);

  public resetCalls(): void {
    this.calls = [];
  }

  public async getAccount(accountId: string): Promise<any> {
    this.calls.push({ method: "getAccount", args: [accountId] });
    const acc = this.accounts.get(accountId);
    if (!acc) {
      throw new Error(`Unipile account '${accountId}' not found.`);
    }
    return {
      id: acc.id,
      name: acc.name,
      status: acc.status,
      checkpoint: acc.status === "CHECKPOINT",
      checkpoint_type: acc.checkpointType,
    };
  }

  public async solveCheckpoint(accountId: string, code: string): Promise<any> {
    this.calls.push({ method: "solveCheckpoint", args: [accountId, code] });
    const acc = this.accounts.get(accountId);
    if (!acc) throw new Error("Account not found");
    if (code === "123456") {
      acc.status = "OK";
      delete acc.checkpointType;
      return { success: true, message: "Checkpoint solved successfully." };
    }
    return { success: false, message: "Invalid verification code." };
  }

  public async resendCheckpoint(accountId: string): Promise<any> {
    this.calls.push({ method: "resendCheckpoint", args: [accountId] });
    return { success: true, message: "Verification code resent." };
  }

  public async disconnectAccount(accountId: string): Promise<boolean> {
    this.calls.push({ method: "disconnectAccount", args: [accountId] });
    const acc = this.accounts.get(accountId);
    if (acc) {
      acc.status = "DISCONNECTED";
    }
    return true;
  }

  public async sendMessage(chatId: string, text: string, accountId?: string): Promise<any> {
    this.calls.push({ method: "sendMessage", args: [chatId, text, accountId] });
    return {
      id: `mock-msg-${Date.now()}`,
      chat_id: chatId,
      text,
      account_id: accountId,
      timestamp: new Date().toISOString(),
    };
  }
}

export const mockUnipileClient = new MockUnipileClient();
