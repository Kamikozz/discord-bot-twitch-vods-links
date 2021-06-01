const mongoose = require('mongoose');

const { Schema, model } = mongoose;

const { error } = require('../utils');

const errorHandler = (err, result) => {
  if (err) error(err, result);
};

const settingsSchema = new Schema({
  twitchToken: String,
  twitchReauthId: String,
  twitchSubscriptions: Object,
  youtubeRefreshToken: String,
  youtubeRtmpStreamId: String,
}, { versionKey: false });

/**
 * Gets settings from MongoDB.
 */
settingsSchema.statics.getSettings = function () {
  return this.findOne({}, (err, result) => {
    errorHandler(err, result);
  });
};

/**
 * @param {String} twitchToken
 */
settingsSchema.statics.setTwitchToken = function (twitchToken) {
  return this.findOneAndUpdate({}, {
    twitchToken,
  }, { upsert: true }, (err, result) => {
    errorHandler(err, result);
    process.env.TWITCH_TOKEN = twitchToken;
  });
};

/**
 * @param {String} id twitchReauthId
 */
settingsSchema.statics.setTwitchReauthId = function (twitchReauthId) {
  return this.findOneAndUpdate({}, {
    twitchReauthId,
  }, { upsert: true }, errorHandler);
};

/**
 *
 * @param {String} twitchUsername
 * @param {String} scheduledRenewalId
 */
settingsSchema.statics.subscribe = function (twitchUsername, scheduledRenewalId) {
  return this.findOneAndUpdate({}, {
    $set: {
      [`twitchSubscriptions.${twitchUsername}`]: scheduledRenewalId,
    },
  }, { upsert: true }, errorHandler);
};

/**
 *
 * @param {String} twitchUsername
 */
settingsSchema.statics.unsubscribe = function (twitchUsername) {
  return this.findOneAndUpdate({}, {
    $unset: {
      [`twitchSubscriptions.${twitchUsername}`]: '',
    },
  }, errorHandler);
};

/**
 *
 * @param {String} refreshToken
 */
settingsSchema.statics.setYoutubeRefreshToken = function (refreshToken) {
  return this.findOneAndUpdate({}, {
    youtubeRefreshToken: refreshToken,
  }, { upsert: true }, errorHandler);
};

/**
 * Save "config" of the YouTube LiveStream.
 * @param {String} rtmpStreamId
 */
settingsSchema.statics.setYoutubeRtmpStreamId = function (rtmpStreamId) {
  return this.findOneAndUpdate({}, {
    youtubeRtmpStreamId: rtmpStreamId,
  }, { upsert: true }, errorHandler);
};

module.exports = model('Settings', settingsSchema);
