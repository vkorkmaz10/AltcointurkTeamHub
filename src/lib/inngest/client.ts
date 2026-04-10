import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "altcointurk-team-hub",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
