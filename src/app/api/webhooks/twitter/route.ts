/**
 * Alias: /api/webhooks/twitter → same logic as /api/webhook/apify
 * Both endpoints accept scraped tweet data and fire Inngest events.
 */
export { POST } from "@/app/api/webhook/apify/route";
