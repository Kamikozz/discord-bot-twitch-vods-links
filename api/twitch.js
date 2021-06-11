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

const eventSub = {
  // https://dev.twitch.tv/docs/eventsub#response
  subscriptionsStatus: {
    enabled: 'enabled', // designates that the subscription is in an operable state and is valid.
    webhookCallbackVerificationPending: 'webhook_callback_verification_pending', // webhook is pending verification of the callback specified in the subscription creation request.
    webhookCallbackVerificationFailed: 'webhook_callback_verification_failed', // webhook failed verification of the callback specified in the subscription creation request.
    notificationFailuresExceeded: 'notification_failures_exceeded', // notification delivery failure rate was too high.
    authorizationRevoked: 'authorization_revoked', // authorization for user(s) in the condition was revoked.
    userRemoved: 'user_removed', // a user in the condition of the subscription was removed.
  },

  getSubscriptions(status = '') {
    const baseHeaders = getBaseHeaders();
    const queryParams = buildQueryString({ status });
    const options = {
      headers: baseHeaders,
      hostname: apiUrl.hostname,
      path: `${apiUrl.pathname}/eventsub/subscriptions?${queryParams}`,
      method: 'GET',
    };
    return fetch(options)
      .then((res) => {
        const data = res.json();
        if (res.statusCode !== 200) {
          throw new Error(`[Twitch EventSub] /getSubscriptions ${data.error} (${res.statusCode}): ${data.message}`);
        }
        return data;
      });
  },

  /**
   * @param {string} subscriptionType https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types
   */
  createSubscription(subscriptionType, userId) {
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
        broadcaster_user_id: userId,
      },
      transport: {
        method: 'webhook',
        callback: `${process.env.HOST_URL}/twitch`,
        secret: process.env.TWITCH_SIGNING_SECRET,
      },
    };
    return fetch(options, data)
      .then((res) => {
        const json = res.json();
        if (res.statusCode !== 202) {
          throw new Error(`[Twitch EventSub] /createSubscription ${json.error} (${res.statusCode}): ${json.message}`);
        }
        return json;
      });
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
    return fetch(options)
      .then((res) => {
        if (res.statusCode !== 204) {
          const json = res.json();
          throw new Error(`[Twitch EventSub] /cancelSubscription ${json.error} (${res.statusCode}): ${json.message}`);
        }
      });
  },
};

const subscribe = async (searchByName) => {
  const [userInformation] = await getUsersInformationByNames([searchByName]);
  if (!userInformation) throw new Error(`User \`${searchByName}\` doesn't exist on Twitch`);
  const { id: userId } = userInformation;
  return Promise.all(
    ['stream.online', 'stream.offline']
      .map((subscriptionType) => eventSub.createSubscription(subscriptionType, userId)),
  );
};

const unsubscribe = async (searchByName) => {
  const [userInformation] = await getUsersInformationByNames([searchByName]);
  if (!userInformation) {
    throw new Error(`User \`${searchByName}\` doesn't exist on Twitch`);
  }
  const { id: userId } = userInformation;
  const { data: subscriptions } = await eventSub.getSubscriptions();
  const subscriptionsFilteredByUserId = subscriptions
    .filter(({ condition }) => condition.broadcaster_user_id === userId);
  if (!subscriptionsFilteredByUserId.length) {
    throw new Error(`Вы не подписаны на ${searchByName}`);
  }
  return Promise.all(
    subscriptionsFilteredByUserId
      .map(({ id: subscriptionId }) => eventSub.deleteSubscription(subscriptionId)),
  );
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

const getStreams = (userId, streamsQuantity = 1) => {
  const queryParams = buildQueryString({
    first: streamsQuantity,
    user_id: userId,
  });
  const options = {
    headers: getBaseHeaders(),
    hostname: apiUrl.hostname,
    path: `${apiUrl.pathname}/streams?${queryParams}`,
    method: 'GET',
  };
  return fetch(options)
    .then((res) => {
      const json = res.json();
      if (res.statusCode !== 200) {
        throw new Error(`[Twitch] /streams ${json.error} (${res.statusCode}): ${json.message}`);
      }
      return json.data;
    });
};

module.exports = {
  token,
  auth,
  getSubscriptions,
  getUsersInformationByIds,
  getUsersInformationByNames,
  getUsersInformation,
  subscribe,
  unsubscribe,
  getUserVideos,
  eventSub,
  getStreams,
};
