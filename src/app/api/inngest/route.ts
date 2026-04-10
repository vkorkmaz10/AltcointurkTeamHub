import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { inngestFunctions } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
  // Allow Inngest Cloud to reach this endpoint on Vercel
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL && {
    serveHost: `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  }),
  servePath: "/api/inngest",
});
