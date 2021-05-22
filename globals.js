module.exports = Object.freeze({
  PORT: process.env.PORT || 3000,
  DISCORD_BOT_AVATAR_URL: process.env.DISCORD_BOT_AVATAR_URL || 'https://picsum.photos/200/300',
  DISCORD_BOT_CHANNEL_ID: process.env.DISCORD_BOT_CHANNEL_ID,
  DISCORD_WEBHOOK_PATH: process.env.DISCORD_WEBHOOK_PATH,

  // twitch.tv subscription duration (max=10days)
  SUBSCRIPTION_LEASE_SECONDS: 10 * 24 * 60 * 60,

  // twitch.tv token duration (max=different from 57 to 65 days)
  TWITCH_TOKEN_LEASE_SECONDS: 50 * 24 * 60 * 60,

  YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,

  // redirect uri which is used to complete YouTube's OAuth flow
  YOUTUBE_REDIRECT_URI: process.env.YOUTUBE_REDIRECT_URI,
});
