const https = require('https');

const { SUBSCRIPTION_LEASE_SECONDS } = require('../globals');
const { buildQueryString } = require('../utils');
const scheduler = require('./scheduler');
const Settings = require('../models/settings.model');

const isValidTwitchClientId = (clientId) => clientId === process.env.TWITCH_CLIENT_ID;

const getBaseOptions = () => [{
  hostname: 'api.twitch.tv',
}, {
  Authorization: `Bearer ${process.env.TWITCH_TOKEN}`,
  'Client-Id': process.env.TWITCH_CLIENT_ID,
}];

const token = () => {
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = process.env;
  const queryParams = buildQueryString({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const options = {
    hostname: 'id.twitch.tv',
    path: `/oauth2/token?${queryParams}`,
    method: 'POST',
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
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
    req.end();
  });
};

const auth = async ({
  clientId,
}) => {
  if (!isValidTwitchClientId(clientId)) return 'ClientId doesn\'t match';

  const authenticationResult = await token();
  const { access_token: accessToken } = authenticationResult;
  if (!accessToken) return 'No \'access_token\' received';

  await Settings.setTwitchToken(accessToken);

  const schedulerResponse = await scheduler.scheduleReauth() || {};
  const { id, message } = schedulerResponse;
  if (!id) return `Scheduler error: ${message}`;

  const { twitchReauthId } = await Settings.getSettings() || {};
  if (twitchReauthId) scheduler.cancelSchedule(twitchReauthId);
  await Settings.setTwitchReauthId(id);
};

/**
 * Get users information (limit to 100 users).
 * @param {Array | String} users if presented as String then it's already queryString
 * @param {String} idOrLogin separator or param name. Can be 'id' or 'login'
*/
const getUsersInformation = (users, idOrLogin) => {
  const queryString = idOrLogin
    ? users.map((user) => `${idOrLogin}=${user}`).join('&')
    : users;
  const [baseOptions, headers] = getBaseOptions();
  const options = {
    ...baseOptions,
    headers,
    path: `/helix/users?${queryString}`,
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

/**
 * Get users information (limit to 100 users) by user_id.
 * @param {Array} userIds
 */
const getUsersInformationByIds = (userIds) => getUsersInformation(userIds, 'id');

/**
 * Get users information (limit to 100 users) by username.
 * Ex. 'display_name', 'login', 'id'
 * @param {Array} usernames
 */
const getUsersInformationByNames = (usernames) => getUsersInformation(usernames, 'login');

const subscribeAndUnsubscribeHandler = (userId, leaseSeconds, isSubscribe) => {
  const [baseOptions, headers] = getBaseOptions();
  const options = {
    ...baseOptions,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    path: '/helix/webhooks/hub',
    method: 'POST',
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const isOk = res.statusCode === 202;
      if (isOk) {
        resolve();
      } else {
        reject();
      }
    });
    req.end(JSON.stringify({
      'hub.callback': `${process.env.HOST_URL}/twitch?userId=${userId}`,
      'hub.mode': isSubscribe ? 'subscribe' : 'unsubscribe',
      'hub.topic': `https://api.twitch.tv/helix/streams?user_id=${userId}`,
      'hub.lease_seconds': leaseSeconds,
    }));
  });
};

const subscribe = (userId, leaseSeconds = 0) => (
  subscribeAndUnsubscribeHandler(userId, leaseSeconds, true)
);

const unsubscribe = (userId, leaseSeconds = 0) => (
  subscribeAndUnsubscribeHandler(userId, leaseSeconds, false)
);

const resubscribe = async ({
  clientId,
  searchByName,
  userId,
  login,
}) => {
  if (!isValidTwitchClientId(clientId)) return 'ClientId doesn\'t match';

  let twitchUserId;
  let twitchUsername;
  if (searchByName) {
    const [userInformation] = await getUsersInformationByNames([searchByName]);
    if (!userInformation) return `User \`${searchByName}\` doesn't exist on Twitch`;
    const { id, login: twitchLogin } = userInformation;
    twitchUserId = id;
    twitchUsername = twitchLogin;
  } else {
    twitchUserId = userId;
    twitchUsername = login;
  }

  try {
    await subscribe(twitchUserId, SUBSCRIPTION_LEASE_SECONDS);
  } catch (err) {
    return `Twitch user subscribe error: ${err}`;
  }

  const schedulerResponse = await scheduler.scheduleResubscribe(twitchUserId, twitchUsername) || {};
  const { id: newRenewalSubId, message } = schedulerResponse;
  if (!newRenewalSubId) return `Scheduler error: ${message}`;

  const { twitchSubscriptions = {} } = await Settings.getSettings() || {};
  const renewalSubId = twitchSubscriptions[twitchUsername];
  if (renewalSubId) scheduler.cancelSchedule(renewalSubId);
  await Settings.subscribe(twitchUsername, newRenewalSubId);
};

const getSubscriptions = () => {
  const [baseOptions, headers] = getBaseOptions();
  const options = {
    ...baseOptions,
    headers,
    path: '/helix/webhooks/subscriptions',
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

const getUserVideos = (userId) => {
  const [baseOptions, headers] = getBaseOptions();
  const queryParams = buildQueryString({ user_id: userId });
  const options = {
    ...baseOptions,
    headers,
    path: `/helix/videos?${queryParams}`,
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
  resubscribe,
  getSubscriptions,
  getUsersInformationByIds,
  getUsersInformationByNames,
  getUsersInformation,
  subscribe,
  unsubscribe,
  getUserVideos,
};
