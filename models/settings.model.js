const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const errorHandler = (err, result) => {
  if (err) error(err);
};

const userSchema = new Schema({
  twitchReauthId: String,
  twitchSubscriptions: Object,
}, { versionKey: false });

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
