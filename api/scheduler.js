const https = require('https');

const { TWITCH_TOKEN_LEASE_SECONDS } = require('../globals');
const { buildQueryString } = require('../utils');

const baseOptions = {
  hostname: 'api.schedulerapi.com',
  headers: {
    'x-api-key': process.env.SCHEDULER_API_KEY,
  },
};

/**
 *
 * @param {Date} when
 * @param {String | Object} body
 */
const schedule = (when, url, body = '', headers = {}) => {
  const isPostRequest = Boolean((typeof body === 'string' ? body : Object.keys(body)).length);
  const options = {
    ...baseOptions,
    headers: {
      ...baseOptions.headers,
      'Content-Type': 'application/json',
    },
    path: '/schedule',
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
        if (res.statusCode === 200) {
          resolve(parsedJson);
        } else {
          reject(parsedJson);
        }
      });
      res.on('error', () => {
        reject();
      });
    });
    req.end(JSON.stringify({
      when: when.toISOString(),
      protocol: 'webhook',
      payload: {
        method: isPostRequest ? 'post' : 'get',
        url,
        header: headers,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
    }));
  });
};

const scheduleReauth = () => {
  const { HOST_URL, TWITCH_CLIENT_ID } = process.env;
  const when = new Date(Date.now() + TWITCH_TOKEN_LEASE_SECONDS * 1000);
  const queryParams = buildQueryString({ clientId: TWITCH_CLIENT_ID });
  const url = `${HOST_URL}/auth?${queryParams}`;
  return schedule(when, url);
};

const updateSchedule = ({
  id,
  when,
  protocol = 'webhook',
  payload = {
    method: 'get',
    url: '',
    body: '',
  },
}) => {
  const options = {
    ...baseOptions,
    headers: {
      ...baseOptions.headers,
      'Content-Type': 'application/json',
    },
    path: '/update',
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
        if (res.statusCode === 200) {
          resolve(parsedJson);
        } else {
          reject(parsedJson);
        }
      });
      res.on('error', () => {
        reject();
      });
    });
    req.end(JSON.stringify({
      id,
      when: when.toISOString(),
      protocol,
      payload,
    }));
  });
};

const cancelSchedule = (scheduledTaskId) => {
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  return updateSchedule({
    id: scheduledTaskId,
    when: new Date(Date.now() + FIVE_MINUTES_MS),
  });
};

module.exports = {
  schedule,
  scheduleReauth,
  updateSchedule,
  cancelSchedule,
};
