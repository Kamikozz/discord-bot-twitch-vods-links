require('dotenv').config(); // init process.env
const store = require('./store'); // init local (cache) storage for access_tokens, etc.
require('./globals'); // init global persistent constant storage
const server = require('./server');
const Settings = require('./models/settings.model');
const mongodb = require('./db');

mongodb.init(async () => {
  const settings = await Settings.getSettings() || {};
  // TODO: rewrite this relying on local "store" object
  process.env.TWITCH_TOKEN = settings.twitchToken;
  store.youtube.refreshToken = settings.youtubeRefreshToken;
  store.youtube.rtmpStreamId = settings.youtubeRtmpStreamId;

  server.init();
});
