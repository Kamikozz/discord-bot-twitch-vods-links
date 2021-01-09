const https = require('https');
const credentials = require('./credentials');
const discord = require('./discord');

// TO SUBSCRIBE ON THE STREAM EVENTS
// {
//   "hub.callback": "https://discord.com",
//   "hub.mode": "subscribe",
//   "hub.topic": "https://api.twitch.tv/helix/streams?user_id=",
//   "hub.lease_seconds": 864000
// }

const getUserVideos = (userId = '') => {
  const options = {
    hostname: 'api.twitch.tv',
    path: `/helix/videos?user_id=${userId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${credentials.twitch.token}`,
      'Client-Id': credentials.twitch.clientId,
    },
  };
  let responseData = '';
  const req = https.get(options, (res) => {
    res.on('data', (chunk) => {
      responseData += chunk;
    });
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
};
