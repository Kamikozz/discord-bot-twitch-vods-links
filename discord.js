const https = require('https');

const baseOptions = {
  hostname: 'discord.com',
  path: '',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const sendToDiscord = (json) => {
  const options = {
    ...baseOptions,
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

module.exports = {
  sendToDiscord,
  sendToDiscordFormatted,
};
