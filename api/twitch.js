const { SUBSCRIPTION_LEASE_SECONDS } = require('../globals');
const { buildQueryString, fetch } = require('../utils');
const scheduler = require('./scheduler');
const Settings = require('../models/settings.model');

const isValidTwitchClientId = (clientId) => clientId === process.env.TWITCH_CLIENT_ID;

const authUrl = new URL('https://id.twitch.tv/oauth2');
const apiUrl = new URL('https://api.twitch.tv/helix');

const getBaseHeaders = () => ({
  Authorization: `Bearer ${process.env.TWITCH_TOKEN}`,
  'Client-Id': process.env.TWITCH_CLIENT_ID,
});

const token = () => {
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = process.env;
  const queryParams = buildQueryString({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const options = {
    hostname: authUrl.hostname,
    path: `${authUrl.pathname}/token?${queryParams}`,
    method: 'POST',
  };
  return fetch(options)
    .then((res) => res.json());
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
  const baseHeaders = getBaseHeaders();
  const options = {
    headers: baseHeaders,
    hostname: apiUrl.hostname,
    path: `${apiUrl.pathname}/users?${queryString}`,
    method: 'GET',
  };
  return fetch(options)
    .then((res) => res.json())
    .then(({ data }) => data);
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

/**
 * @deprecated
 */
const subscribeAndUnsubscribeHandler = (userId, leaseSeconds, isSubscribe) => {
  const baseHeaders = getBaseHeaders();
  const options = {
    headers: {
      ...baseHeaders,
      'Content-Type': 'application/json',
    },
    hostname: apiUrl.hostname,
    path: `${apiUrl.pathname}/webhooks/hub`,
    method: 'POST',
  };
  const data = {
    'hub.callback': `${process.env.HOST_URL}/twitch?userId=${userId}`,
    'hub.mode': isSubscribe ? 'subscribe' : 'unsubscribe',
    'hub.topic': `${apiUrl.href}/streams?user_id=${userId}`,
    'hub.lease_seconds': leaseSeconds,
  };
  return fetch(options, data)
    .then((res) => {
      if (res.statusCode !== 202) {
        throw new Error();
      }
      return res;
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
  const baseHeaders = getBaseHeaders();
  const options = {
    headers: baseHeaders,
    hostname: apiUrl.hostname,
    path: `${apiUrl.pathname}/webhooks/subscriptions`,
    method: 'GET',
  };
  return fetch(options)
    .then((res) => res.json());
};

const getUserVideos = (userId) => {
  const baseHeaders = getBaseHeaders();
  const queryParams = buildQueryString({ user_id: userId });
  const options = {
    headers: baseHeaders,
    hostname: apiUrl.hostname,
    path: `${apiUrl.pathname}/videos?${queryParams}`,
    method: 'GET',
  };
  return fetch(options)
    .then((res) => res.json())
    .then(({ data }) => data);
};

const eventSub = {
  getSubscriptions() {
    const baseHeaders = getBaseHeaders();
    const options = {
      headers: baseHeaders,
      hostname: apiUrl.hostname,
      path: `${apiUrl.pathname}/eventsub/subscriptions`,
      method: 'GET',
    };
    return fetch(options);
  },

  /**
   * @param {string} subscriptionType https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types
   */
  createSubscription(subscriptionType) {
    const baseHeaders = getBaseHeaders();
    const options = {
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/json',
      },
      hostname: apiUrl.hostname,
      path: `${apiUrl.pathname}/eventsub/subscriptions`,
      method: 'POST',
    };
    const data = {
      type: subscriptionType,
      version: '1',
      condition: {
        broadcaster_user_id: '12826',
      },
      transport: {
        method: 'webhook',
        callback: 'https://a70b94490abb.ngrok.io/twitch_eventsub',
        secret: process.env.TWITCH_SIGNING_SECRET,
      },
    };
    return fetch(options, data);
  },

  deleteSubscription(subscriptionId) {
    const baseHeaders = getBaseHeaders();
    const queryParams = buildQueryString({ id: subscriptionId });
    const options = {
      headers: baseHeaders,
      hostname: apiUrl.hostname,
      path: `${apiUrl.pathname}/eventsub/subscriptions?${queryParams}`,
      method: 'DELETE',
    };
    return fetch(options);
  },
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
  eventSub,
};
