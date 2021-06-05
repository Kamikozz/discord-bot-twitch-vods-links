module.exports = {
  youtube: {
    accessToken: '',
    expiresIn: null,
    refreshToken: null,
    rtmpStreamId: '', // "config" of the YouTube LiveStream
  },
  twitch: {
    messages: new Set(), // deduplication purposes of the EventSub events
  },
};
