const https = require('https');

const { TWITCH_TOKEN_LEASE_SECONDS } = require('../globals');

const baseOptions = {
  hostname: 'api.schedulerapi.com',
  headers: {
    'x-api-key': process.env.SCHEDULER_API_KEY,
  },
};

/**
 * 
 * @param {Date} when
 * @param {String} body
 */
const schedule = (when, url, body = '') => {
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
          reject(parsedJson)
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
        method: body === '' ? 'get' : 'post',
        url,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
    }));
  });
};

const scheduleReauth = () => {
  const when = new Date(Date.now() + TWITCH_TOKEN_LEASE_SECONDS * 1000);
  const url = `${process.env.HOST_URL}/auth?clientId=${process.env.TWITCH_CLIENT_ID}`;
  return schedule(when, url);
};

module.exports = {
  schedule,
  scheduleReauth,
};
