const nacl = require('tweetnacl');

const isValidRequest = (signature, timestamp, requestBody) => {
  return nacl.sign.detached.verify(
    Buffer.from(timestamp + requestBody),
    Buffer.from(signature, 'hex'),
    Buffer.from(process.env.DISCORD_APPLICATION_PUBLIC_KEY, 'hex'),
  );
};

const isProduction = () => process.env.MODE === 'production';

module.exports = {
  isValidRequest,
  isProduction,
};