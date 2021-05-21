require('dotenv').config(); // init process.env
require('./store'); // init local (cache) storage for access_tokens, etc.
const server = require('./server');
const Settings = require('./models/settings.model');
const mongodb = require('./db');

mongodb.init(async () => {
  const settings = await Settings.getSettings() || {};
  process.env.TWITCH_TOKEN = settings.twitchToken;
  // TODO: process.env.YOUTUBE_REFRESH_TOKEN

  server.init();
});
