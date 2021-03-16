const https = require('https');

const baseOptions = {
  hostname: 'api.heroku.com',
  headers: {
    Authorization: `Bearer ${process.env.HEROKU_API_KEY}`,
    Accept: 'application/vnd.heroku+json; version=3',
  },
};

const getConfigVars = () => {
  const options = {
    ...baseOptions,
    headers: {
      ...baseOptions.headers,
    },
    path: `/apps/${process.env.HEROKU_APP_NAME}/config-vars`,
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
        if (res.statusCode === 200) {
          resolve(parsedJson);
        } else {
          reject();
        }
      });
      res.on('error', () => {
        reject();
      });
    });
  });
};

const setConfigVars = (data = {}) => {
  const options = {
    ...baseOptions,
    headers: {
      ...baseOptions.headers,
      'Content-Type': 'application/json',
    },
    path: `/apps/${process.env.HEROKU_APP_NAME}/config-vars`,
    method: 'PATCH',
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
          reject()
        }
      });
      res.on('error', () => {
        reject();
      });
    });
    req.end(JSON.stringify(data));
  });
};

module.exports = {
  getConfigVars,
  setConfigVars,
};
