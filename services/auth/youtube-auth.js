const https = require('https');

const { YOUTUBE_REDIRECT_URI, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET } = require('../../globals');
const store = require('../../store');
const Settings = require('../../models/settings.model');
const { buildQueryString, error } = require('../../utils');

/**
 *
 * @param {string} accessToken
 * @param {string} expiresIn seconds from now before token expires
 */
const updateAccessToken = (accessToken, expiresIn) => {
  store.youtube.accessToken = accessToken;
  store.youtube.expiresIn = Date.now() + expiresIn * 1000;
};

const fetchAccessToken = (customBody) => {
  const options = {
    headers: {
      'Content-Type': 'application/json',
    },
    hostname: 'accounts.google.com',
    path: '/o/oauth2/token',
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
        const isOk = res.statusCode === 200;
        if (isOk) {
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
      ...customBody,
      client_id: YOUTUBE_CLIENT_ID,
      client_secret: YOUTUBE_CLIENT_SECRET,
    }));
  });
};

const getAccessToken = async (customBody, onSuccess = () => {}) => {
  let response;
  try {
    response = await fetchAccessToken(customBody);
    const { access_token: accessToken, expires_in: expiresIn } = response;
    console.log(response);
    updateAccessToken(accessToken, expiresIn);
    onSuccess(response);
    return true;
  } catch (e) {
    error(e);
    return false;
  }
};

class YoutubeAuthService {
  static isValidToken() {
    return store.youtube.expiresIn > Date.now();
  }

  static hasRefreshToken() {
    return Boolean(store.youtube.refreshToken);
  }

  static createAuthLink() {
    const queryParams = buildQueryString({
      access_type: 'offline',
      response_type: 'code',
      client_id: YOUTUBE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/youtube',
      redirect_uri: YOUTUBE_REDIRECT_URI,
    });
    return `https://accounts.google.com/o/oauth2/auth?${queryParams}`;
  }

  static exchangeSecretsForAccessToken(code) {
    // code is only present if exchanging clientId & clientSecret for access_token
    return getAccessToken({
      code: decodeURIComponent(code),
      grant_type: 'authorization_code',
      redirect_uri: YOUTUBE_REDIRECT_URI,
    }, (json) => {
      console.log('DEBUG-onSuccess', json);
      store.youtube.refreshToken = json.refresh_token;
      Settings.setYoutubeRefreshToken(json.refresh_token);
    });
  }

  static refreshAccessToken() {
    return getAccessToken({
      refresh_token: store.youtube.refreshToken,
      grant_type: 'refresh_token',
    });
  }

  static requestAccessToken() {

  }

  // if (store.youtube.expiresIn < Date.now()) {
  //   try {
  //     await this.refreshAccessToken();
  //   } catch (e) {
  //     error(e.message);
  //     createAuthLink();
  //   }
  // }
}

module.exports = YoutubeAuthService;
