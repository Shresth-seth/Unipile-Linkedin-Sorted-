import { unipileClient } from './src/services/unipile/unipile.client.ts';

const ACCOUNT_ID = '84K4FddgRp-PY2ryCItmzQ';
const MESSAGE = 'Hi {name}, reaching out via WorkPilot! I am building an AI outreach tool and would love your quick feedback. Hope things are going great!';

async function main() {
  console.log('Fetching real LinkedIn connections...');
  const res = await unipileClient.request('/api/v1/users/relations?account_id=' + ACCOUNT_ID + '&limit=10');
  const items = res.items || [];
  console.log('Found ' + items.length + ' connections');
  const targets = items.slice(0, 5);
  let sentCount = 0;
  for (const conn of targets) {
    const firstName = conn.first_name || 'there';
    const fullName = conn.first_name + ' ' + conn.last_name;
    const memberId = conn.member_id;
    const msgText = MESSAGE.replace('{name}', firstName);
    console.log('Sending to ' + fullName + ' (' + memberId + ')...');
    try {
      const r = await unipileClient.request('/api/v1/chats', { method: 'POST', body: JSON.stringify({ account_id: ACCOUNT_ID, attendees_ids: [memberId], text: msgText }) });
      console.log('SUCCESS: ' + fullName + ' -> chat_id: ' + r.chat_id);
      sentCount++;
    } catch(e) { console.error('FAILED: ' + fullName + ' ->', e.message); }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('Done. Sent: ' + sentCount + '/' + targets.length);
}
main().catch(console.error);
