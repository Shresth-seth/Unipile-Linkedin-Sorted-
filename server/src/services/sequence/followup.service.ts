import { actionQueueService } from "../queue/queue.service.js";
import { Contact } from "../../db/schema.js";

export class FollowUpSequencerService {
  public async scheduleFollowUpSequence(
    userId: string,
    contact: Contact,
    messages: {
      followUp1: { text: string; delayMinutes: number };
      followUp2?: { text: string; delayMinutes: number };
    },
  ) {
    const jobs = [];

    const job1 = await actionQueueService.enqueue(
      userId,
      "MESSAGE",
      {
        recipientId: contact.linkedinId,
        message: messages.followUp1.text,
      },
      {
        contactId: contact.id,
        delayMinutes: messages.followUp1.delayMinutes,
      },
    );
    jobs.push(job1);

    if (messages.followUp2) {
      const job2 = await actionQueueService.enqueue(
        userId,
        "MESSAGE",
        {
          recipientId: contact.linkedinId,
          message: messages.followUp2.text,
        },
        {
          contactId: contact.id,
          delayMinutes: messages.followUp2.delayMinutes,
        },
      );
      jobs.push(job2);
    }

    return jobs;
  }
}

export const followUpSequencerService = new FollowUpSequencerService();
