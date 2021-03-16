const https = require('https');

const { TWITCH_SUBSCRIPTION_USER_ID } = require('../globals');
const { log, error } = require('../utils');
const discord = require('./discord');
const scheduler = require('./scheduler');
const heroku = require('./heroku');

const baseOptions = {
  hostname: 'api.twitch.tv',
  headers: {
    'Authorization': `Bearer ${process.env.TWITCH_TOKEN}`,
    'Client-Id': process.env.TWITCH_CLIENT_ID,
  },
};

const token = () => {
  // const options = {
  //   hostname: 'id.twitch.tv',
  //   path: `/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
  //   method: 'POST',
  // };
  // return new Promise((resolve, reject) => {
  //   const req = https.request(options, (res) => {
  //     let responseData = '';
  //     res.on('data', (chunk) => {
  //       responseData += chunk;
  //     });
  //     res.on('end', () => {
  //       const parsedJson = JSON.parse(responseData);
  //       resolve(parsedJson);
  //     });
  //     res.on('error', () => {
  //       reject();
  //     });
  //   });
  //   req.end();
  // });
  return new Promise((res, rej) => {
    res({
      access_token: 'jxokxke99iz3',
      expires_in: 5559211,
      token_type: "bearer",
    });
  });
};

const auth = async ({
  clientId,
}) => {
  const isEqual = clientId === process.env.TWITCH_CLIENT_ID;
  if (!isEqual) return 'ClientId doesn\'t match';
  const authenticationResult = await token();

  const { access_token } = authenticationResult;
  if (!access_token) return 'No \'access_token\' received';

  let configVariables = await heroku.getConfigVars();
  if (!configVariables) return 'Heroku error: getConfigVars';
  configVariables.TWITCH_TOKEN = access_token;
  configVariables = await heroku.setConfigVars(configVariables);
  if (!configVariables) return 'Heroku error: setConfigVars';

  const schedulerResponse = await scheduler.scheduleReauth() || {};
  const { id, message } = schedulerResponse;
  if (!id) return `Scheduler error: ${message}`;
      // {
      //   id: '9v1xU6Z1hSB2yMRTLXBNHg',
      //   when: '2021-03-15 00:42:37',
      //   now: '2021-03-15 00:40:38',
      //   user: '6sqdFXMtZCvYo1MtatrCL6'
      // }

  // let mongoResponse = await mongo.get('settings');
  // mongoResponse.twitchTokenScheduledRenewalId = schedulerResponse.id;
  // mongoResponse = await mongo.set('settings', mongoResponse);
  // if (!mongoResponse error) -> return 'Mongodb error';
  return [authenticationResult, schedulerResponse]; // return undefined;
};

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
  req.end(JSON.stringify({
    'hub.callback': `${process.env.HOST_URL}/twitch`,
    'hub.mode': 'subscribe',
    'hub.topic': `https://api.twitch.tv/helix/streams?user_id=${userId}`,
    'hub.lease_seconds': leaseSeconds,
  }));
};

const getUserVideos = (userId = TWITCH_SUBSCRIPTION_USER_ID) => {
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
  token,
  auth,
  getUserVideos,
  subscribe,
};
