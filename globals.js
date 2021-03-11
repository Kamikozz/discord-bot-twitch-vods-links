module.exports = {
  PORT: process.env.PORT || 3000,
  DISCORD_BOT_AVATAR_URL: process.env.DISCORD_BOT_AVATAR_URL || 'https://picsum.photos/200/300',
  SUBSCRIPTION_LEASE_SECONDS: 864000, // twitch.tv subscription duration (max=10days)
  TWITCH_SUBSCRIPTION_USER_ID: process.env.TWITCH_SUBSCRIPTION_USER_ID,
};
