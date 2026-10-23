import { db } from "./src/db";
import { systemSettings } from "./src/db/schema";
async function run() {
    const s = await db.select().from(systemSettings);
    console.log(s);
}
run();
