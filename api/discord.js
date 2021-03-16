const https = require('https');

const { DISCORD_BOT_AVATAR_URL } = require('../globals');

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
  req.end(JSON.stringify({
    content: JSON.stringify(json),
    avatar_url: DISCORD_BOT_AVATAR_URL,
  }));
};

const sendToDiscordFormatted = ({ title, imageUrl, vodUrl }) => {
  const options = {
    ...baseOptions,
    path: process.env.DISCORD_WEBHOOK_PATH,
  };
  const req = https.request(options);
  req.end(JSON.stringify({
    avatar_url: DISCORD_BOT_AVATAR_URL,
    content: `${title} | ${vodUrl}`,
    embeds: [{
      color: 6570405,
      image: {
        url: imageUrl,
      }
    }]
  }));
};

const createMessage = ({ message, allowedUsersMentionsIds = [] }) => {
  const options = {
    ...baseOptions,
    path: process.env.DISCORD_WEBHOOK_PATH,
  };
  const req = https.request(options);
  req.end(JSON.stringify({
    avatar_url: DISCORD_BOT_AVATAR_URL,
    content: message,
    allowed_mentions: {
      users: allowedUsersMentionsIds,
    },
  }));
};

// TODO: доделать алгоритм
const getMessages = ({ channelId = process.env.DISCORD_BOT_CHANNEL_ID }) => {
  const options = {
    ...baseOptions,
    headers: {
      ...baseOptions.headers,
      'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    },
    path: `/api/channels/${channelId}/messages`,
    method: 'GET',
  };
  return new Promise((resolve, reject) => {
    https.get(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        const parsedJson = JSON.parse(responseData);
        resolve(parsedJson);
      });
      res.on('error', () => {
        reject();
      });
    });
  });
};

module.exports = {
  sendToDiscord,
  sendToDiscordFormatted,
  createMessage,
  getMessages,
};
