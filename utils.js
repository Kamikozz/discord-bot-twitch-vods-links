const nacl = require('tweetnacl');
const credentials = require('./credentials');

const isValidRequest = (signature, timestamp, requestBody) => {
  return nacl.sign.detached.verify(
    Buffer.from(timestamp + requestBody),
    Buffer.from(signature, 'hex'),
    Buffer.from(credentials.discord.applicationPublicKey, 'hex'),
  );
};

module.exports = {
  isValidRequest,
};
