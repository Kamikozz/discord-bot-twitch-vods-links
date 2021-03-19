module.exports = {
  PORT: process.env.PORT || 3000,
  DISCORD_BOT_AVATAR_URL: process.env.DISCORD_BOT_AVATAR_URL || 'https://picsum.photos/200/300',
  SUBSCRIPTION_LEASE_SECONDS: 10 * 24 * 60 * 60, // twitch.tv subscription duration (max=10days)
  TWITCH_TOKEN_LEASE_SECONDS: 50 * 24 * 60 * 60, // twitch.tv token duration (max=different from 57 to 65 days)
};
