const https = require('https');

const AuthService = require('./auth/auth');
const YoutubeAuthService = require('./auth/youtube-auth');
const { buildQueryString } = require('../utils');

// https://youtube.googleapis.com/youtube/v3
const baseOptions = {
  headers: {
    'Content-Type': 'application/json',
  },
  hostname: 'youtube.googleapis.com',
  path: '/youtube/v3',
};

const liveBroadcasts = (() => {
  const getLiveBroadcastsBaseOptions = () => ({
    ...baseOptions,
    headers: {
      ...baseOptions.headers,
    },
    path: `${baseOptions.path}/liveBroadcasts?access_token=${YoutubeAuthService.getAccessToken()}`,
  });

  return {
    fetchList() {
      const liveBroadcastsBaseOptions = getLiveBroadcastsBaseOptions();
      const queryParams = buildQueryString({
        part: 'snippet,contentDetails,status',
        broadcastType: 'all',
        mine: 'true',
      });
      const options = {
        ...liveBroadcastsBaseOptions,
        path: `${liveBroadcastsBaseOptions.path}&${queryParams}`,
        method: 'GET',
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
        req.end();
      });
    },

    insert({ title, privacyStatus } = { title: 'Another translation', privacyStatus: 'private' }) {
      const liveBroadcastsBaseOptions = getLiveBroadcastsBaseOptions();
      const queryParams = buildQueryString({
        part: 'snippet,contentDetails,status',
      });
      const options = {
        ...liveBroadcastsBaseOptions,
        path: `${liveBroadcastsBaseOptions.path}&${queryParams}`,
        method: 'POST',
      };
      const fiveMinutesMs = 60 * 5 * 1000;
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
          contentDetails: {
            latencyPreference: 'normal',
            enableAutoStart: true,
            enableAutoStop: true,
          },
          snippet: {
            title,
            scheduledStartTime: new Date(Date.now() + fiveMinutesMs).toISOString(),
          },
          status: {
            privacyStatus,
          },
        }));
      });
    },

    bind(broadcastId, streamId) {
      const liveBroadcastsBaseOptions = getLiveBroadcastsBaseOptions();
      const queryParams = buildQueryString({
        access_token: YoutubeAuthService.getAccessToken(),
        part: 'contentDetails,snippet',
        id: broadcastId,
        streamId,
      });
      const options = {
        ...liveBroadcastsBaseOptions,
        path: `${baseOptions.path}/liveBroadcasts/bind?${queryParams}`,
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
        req.end();
      });
    },
  };
})();

const liveStreams = (() => {
  const getLiveStreamsBaseOptions = () => ({
    ...baseOptions,
    headers: {
      ...baseOptions.headers,
    },
    path: `${baseOptions.path}/liveStreams?access_token=${YoutubeAuthService.getAccessToken()}`,
  });

  return {
    fetchList() {
      const liveStreamBaseOptions = getLiveStreamsBaseOptions();
      const queryParams = buildQueryString({
        part: 'snippet,cdn,contentDetails,status',
        mine: 'true',
      });
      const options = {
        ...liveStreamBaseOptions,
        path: `${liveStreamBaseOptions.path}&${queryParams}`,
        method: 'GET',
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
        req.end();
      });
    },

    insert() {
      const liveStreamBaseOptions = getLiveStreamsBaseOptions();
      const queryParams = buildQueryString({
        part: 'id,snippet,cdn,contentDetails,status',
      });
      const options = {
        ...liveStreamBaseOptions,
        path: `${liveStreamBaseOptions.path}&${queryParams}`,
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
          snippet: {
            title: 'RTMP key for streams re-streaming',
          },
          cdn: {
            frameRate: 'variable',
            ingestionType: 'rtmp',
            resolution: 'variable',
          },
        }));
      });
    },
  };
})();

class YoutubeService {
  static async authorizedRequest(func) {
    const isTokenValid = await AuthService.youtubeTokenValidation();
    if (isTokenValid) return func();
  }

  // Live Broadcasts
  static liveBroadcastsList() {
    return this.authorizedRequest(liveBroadcasts.fetchList);
  }

  /**
   * @param paramsObj {{ title, privacyStatus }}
   */
  static liveBroadcastsInsert(paramsObj) {
    return this.authorizedRequest(() => liveBroadcasts.insert(paramsObj));
  }

  /**
   * @param {string} broadcastId what Broadcast will be assigned to Stream
   * @param {string} streamId Stream
   */
  static liveBroadcastsBind(broadcastId, streamId) {
    return this.authorizedRequest(() => liveBroadcasts.bind(broadcastId, streamId));
  }

  // Live Streams
  static liveStreamsList() {
    return this.authorizedRequest(liveStreams.fetchList);
  }

  static liveStreamsInsert() {
    return this.authorizedRequest(liveStreams.insert);
  }
}

module.exports = YoutubeService;
