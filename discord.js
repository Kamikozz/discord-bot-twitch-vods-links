const https = require('https');

const WEBHOOK_PATH = '';

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
    path: WEBHOOK_PATH,
  };
  const req = https.request(options);
  req.write(JSON.stringify({
    content: JSON.stringify(json),
    avatar_url: 'https://picsum.photos/200/300',
  }));
  req.end();
};

const sendToDiscordFormatted = ({ title, imageUrl, vodUrl }) => {
  const options = {
    ...baseOptions,
    path: WEBHOOK_PATH,
  };
  const req = https.request(options);
  req.write(JSON.stringify({
    avatar_url: '',
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
    path: WEBHOOK_PATH,
  };
  const req = https.request(options);
  req.write(JSON.stringify({
    avatar_url: '',
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
