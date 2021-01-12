const https = require('https');
const discord = require('./discord');

const baseOptions = {
  hostname: 'api.twitch.tv',
  headers: {
    'Authorization': `Bearer ${process.env.TWITCH_TOKEN}`,
    'Client-Id': process.env.TWITCH_CLIENT_ID,
  },
}

const subscribe = ({
  userId = '',
  leaseSeconds = 0,
  callback = () => {},
  error = () => {
    discord.createMessage({ message: 'При обновлении подписки что-то пошло не так' });
  },
}) => {
  const options = {
    ...baseOptions,
    headers: {
      ...baseOptions.headers,
      'Content-Type': 'application/json',
    },
    path: `/helix/webhooks/hub`,
    method: 'POST',
  };
  const req = https.request(options, (res) => {
    const isOk = res.statusCode === 202;
    if (isOk) {
      callback();
    } else {
      error();
    }
  });
  req.write(JSON.stringify({
    'hub.callback': '/twitch',
    'hub.mode': 'subscribe',
    'hub.topic': `https://api.twitch.tv/helix/streams?user_id=${userId}`,
    'hub.lease_seconds': leaseSeconds,
  }));
  req.end();
};

const getUserVideos = (userId = '') => {
  const options = {
    ...baseOptions,
    path: `/helix/videos?user_id=${userId}`,
    method: 'GET',
  };
  https.get(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => responseData += chunk);
    res.on('end', () => {
      const parsedObj = JSON.parse(responseData);
      const lastVideo = parsedObj.data[0];
      const mappedObj = {
        title: lastVideo.title,
        thumbnail_url: lastVideo.thumbnail_url,
      };
      const discordObj = {
        title: mappedObj.title,
        imageUrl: mappedObj.thumbnail_url
          .replace('%{width}', '600')
          .replace('%{height}', '350'),
        vodUrl: `https://vod-secure.twitch.tv/${mappedObj.thumbnail_url.split('/')[5]}/chunked/index-dvr.m3u8`,
      };
      discord.sendToDiscordFormatted(discordObj);
    });
  });
};

module.exports = {
  getUserVideos,
  subscribe,
};
