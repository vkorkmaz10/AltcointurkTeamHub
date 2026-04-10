import { TwitterApi } from "twitter-api-v2";

interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

/**
 * Create a Twitter API client for a specific user
 */
export function createTwitterClient(credentials: TwitterCredentials) {
  return new TwitterApi({
    appKey: credentials.apiKey,
    appSecret: credentials.apiSecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.accessSecret,
  });
}

/**
 * Reply to a tweet using a user's own API keys
 */
export async function replyToTweet(
  credentials: TwitterCredentials,
  tweetId: string,
  text: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    const client = createTwitterClient(credentials);
    const rwClient = client.readWrite;

    const { data } = await rwClient.v2.reply(text, tweetId);

    return {
      success: true,
      replyId: data.id,
    };
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string; data?: { detail?: string } };

    // Handle rate limiting
    if (err.code === 429) {
      return {
        success: false,
        error: "Rate limit exceeded. Please try again later.",
      };
    }

    return {
      success: false,
      error: err.data?.detail || err.message || "Unknown Twitter API error",
    };
  }
}

/**
 * Like a tweet using a user's own API keys
 */
export async function likeTweet(
  credentials: TwitterCredentials,
  userId: string,
  tweetId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createTwitterClient(credentials);
    const rwClient = client.readWrite;

    await rwClient.v2.like(userId, tweetId);

    return { success: true };
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string; data?: { detail?: string } };

    if (err.code === 429) {
      return {
        success: false,
        error: "Rate limit exceeded for likes.",
      };
    }

    return {
      success: false,
      error: err.data?.detail || err.message || "Unknown Twitter API error",
    };
  }
}

/**
 * Verify API credentials by fetching the authenticated user
 */
export async function verifyCredentials(
  credentials: TwitterCredentials
): Promise<{ success: boolean; userId?: string; username?: string; error?: string }> {
  try {
    const client = createTwitterClient(credentials);
    const me = await client.v2.me();

    return {
      success: true,
      userId: me.data.id,
      username: me.data.username,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      success: false,
      error: err.message || "Invalid credentials",
    };
  }
}
