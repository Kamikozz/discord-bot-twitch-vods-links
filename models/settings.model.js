const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const errorHandler = (err, result) => {
  if (err) error(err);
};

const userSchema = new Schema({
  twitchToken: String,
  twitchReauthId: String,
  twitchSubscriptions: Object,
}, { versionKey: false });

/**
 * Gets settings from MongoDB & sets TWITCH_TOKEN variable to the environment.
 */
userSchema.statics.getSettings = function () {
  return this.findOne({}, (err, result) => {
    errorHandler(err, result);
    process.env.TWITCH_TOKEN = (result || {}).twitchToken;
  });
};

/**
 * @param {String} twitchToken
 */
userSchema.statics.setTwitchToken = function (twitchToken) {
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
userSchema.statics.setTwitchReauthId = function (twitchReauthId) {
  return this.findOneAndUpdate({}, {
    twitchReauthId,
  }, { upsert: true }, errorHandler);
};

/**
 *
 * @param {String} twitchUsername
 * @param {String} scheduledRenewalId
 */
userSchema.statics.subscribe = function (twitchUsername, scheduledRenewalId) {
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
userSchema.statics.unsubscribe = function (twitchUsername) {
  return this.findOneAndUpdate({}, {
    $unset: {
      [`twitchSubscriptions.${twitchUsername}`]: '',
    },
  }, errorHandler);
};

module.exports = model('Settings', userSchema);
