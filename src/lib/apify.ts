import { ApifyClient } from "apify-client";

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

// Team members to monitor
export const TEAM_HANDLES = [
  "altcointurk",
  "kriptocuma",
  "vkorkmaz10",
  "sharkcrypto",
  "kriptoismail",
  "mungonmun",
  "0xCoinacci",
  "Goktug1O",
  "EskinnBerna",
  "tradermiraz",
  "Coinocracy",
  "ozgurrr78",
] as const;

export type TeamHandle = (typeof TEAM_HANDLES)[number];

interface ScrapedTweet {
  id: string;
  full_text?: string;
  text?: string;
  user?: {
    screen_name: string;
    name: string;
  };
  author?: {
    userName: string;
    name?: string;
  };
  url?: string;
  isRetweet?: boolean;
  isReply?: boolean;
  isQuote?: boolean;
  retweeted_status?: unknown;
  in_reply_to_status_id?: string | null;
  in_reply_to_status_id_str?: string | null;
  quoted_status_id_str?: string | null;
}

/**
 * Run the Twitter scraper Actor to fetch recent tweets from team members
 */
export async function scrapeTeamTweets(): Promise<ScrapedTweet[]> {
  const actorId = process.env.APIFY_ACTOR_ID || "apidojo/tweet-scraper";

  try {
    const run = await client.actor(actorId).call({
      handles: TEAM_HANDLES.map((h) => `@${h}`),
      tweetsDesired: 5, // last 5 tweets per user
      addUserInfo: true,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items as unknown as ScrapedTweet[];
  } catch (error) {
    console.error("Apify scrape error:", error);
    return [];
  }
}

/**
 * Filter only original tweets (no retweets, replies, or quotes)
 */
export function filterOriginalTweets(tweets: ScrapedTweet[]): ScrapedTweet[] {
  return tweets.filter((tweet) => {
    // Check various indicators that this is NOT an original tweet
    const isRetweet =
      tweet.isRetweet ||
      !!tweet.retweeted_status ||
      (tweet.full_text || tweet.text || "").startsWith("RT @");

    const isReply =
      tweet.isReply ||
      !!tweet.in_reply_to_status_id ||
      !!tweet.in_reply_to_status_id_str;

    const isQuote = tweet.isQuote || !!tweet.quoted_status_id_str;

    return !isRetweet && !isReply && !isQuote;
  });
}

/**
 * Normalize tweet data from various scraper formats
 */
export function normalizeTweet(tweet: ScrapedTweet) {
  const authorHandle =
    tweet.user?.screen_name || tweet.author?.userName || "unknown";
  const authorName =
    tweet.user?.name || tweet.author?.name || authorHandle;
  const content = tweet.full_text || tweet.text || "";
  const tweetUrl =
    tweet.url || `https://x.com/${authorHandle}/status/${tweet.id}`;

  return {
    tweetId: tweet.id,
    authorHandle,
    authorName,
    content,
    tweetUrl,
    isOriginal: true,
    isRetweet: false,
    isReply: false,
  };
}
