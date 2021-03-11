const https = require('https');

const { DISCORD_BOT_AVATAR_URL } = require('./globals');

const baseOptions = {
  hostname: 'discord.com',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const sendToDiscord = (json) => {
  const options = {
    ...baseOptions,
    path: process.env.DISCORD_WEBHOOK_PATH,
  };
  const req = https.request(options);
  req.write(JSON.stringify({
    content: JSON.stringify(json),
    avatar_url: DISCORD_BOT_AVATAR_URL,
  }));
  req.end();
};

const sendToDiscordFormatted = ({ title, imageUrl, vodUrl }) => {
  const options = {
    ...baseOptions,
    path: process.env.DISCORD_WEBHOOK_PATH,
  };
  const req = https.request(options);
  req.write(JSON.stringify({
    avatar_url: DISCORD_BOT_AVATAR_URL,
    content: `${title} | ${vodUrl}`,
    embeds: [{
      color: 6570405,
      image: {
        url: imageUrl,
      }
    }]
  }));
  req.end();
};

const createMessage = ({ message, allowedUsersMentionsIds = [] }) => {
  const options = {
    ...baseOptions,
    path: process.env.DISCORD_WEBHOOK_PATH,
  };
  const req = https.request(options);
  req.write(JSON.stringify({
    avatar_url: DISCORD_BOT_AVATAR_URL,
    content: message,
    allowed_mentions: {
      users: allowedUsersMentionsIds,
    },
  }));
  req.end();
};

module.exports = {
  sendToDiscord,
  sendToDiscordFormatted,
  createMessage,
};
