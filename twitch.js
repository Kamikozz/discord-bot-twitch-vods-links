const https = require('https');

const { TWITCH_SUBSCRIPTION_USER_ID } = require('./globals');
const discord = require('./discord');

const baseOptions = {
  hostname: 'api.twitch.tv',
  headers: {
    'Authorization': `Bearer ${process.env.TWITCH_TOKEN}`,
    'Client-Id': process.env.TWITCH_CLIENT_ID,
  },
}

const subscribe = ({
  userId = TWITCH_SUBSCRIPTION_USER_ID,
  leaseSeconds = 0,
  callback = () => { },
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
    'hub.callback': `${process.env.HOST_URL}/twitch`,
    'hub.mode': 'subscribe',
    'hub.topic': `https://api.twitch.tv/helix/streams?user_id=${userId}`,
    'hub.lease_seconds': leaseSeconds,
  }));
  req.end();
};

const getUserVideos = async (userId = TWITCH_SUBSCRIPTION_USER_ID) => {
  const options = {
    ...baseOptions,
    path: `/helix/videos?user_id=${userId}`,
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
        resolve(parsedJson.data);
      });
      res.on('error', () => {
        reject();
      });
    });
  });
};

module.exports = {
  getUserVideos,
  subscribe,
};
