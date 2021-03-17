const mongoose = require('mongoose');
const { log, error } = require('./utils');

const init = (callback = () => { }) => {
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  };
  // Create the database connection
  mongoose
    .connect(process.env.MONGODB_URI, options, (err) => {
      if (err) {
        error('[MongoDB] Connection error. Make sure your MongoDB config is correct and service is running');
        throw err;
      }
      log('[MongoDB] Successful connection.');
      callback();
    });

  // If the Node process ends, close the Mongoose connection
  process.on('SIGINT', () => {
    mongoose.connection.close(() => {
      log('[MongoDB] Default connection disconnected through app termination');
      process.exit(0);
    });
  });
};

module.exports = {
  init,
};
