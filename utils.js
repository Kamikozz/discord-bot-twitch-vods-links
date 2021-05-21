const nacl = require('tweetnacl');

/**
 * Function that is need to validate your request if using Discord API
 */
const isValidRequest = (request) => {
  const signature = request.get('X-Signature-Ed25519');
  const timestamp = request.get('X-Signature-Timestamp');
  const requestBody = JSON.stringify(request.body);
  return nacl.sign.detached.verify(
    Buffer.from(timestamp + requestBody),
    Buffer.from(signature, 'hex'),
    Buffer.from(process.env.DISCORD_APPLICATION_PUBLIC_KEY, 'hex'),
  );
};

const isProduction = () => process.env.MODE === 'production';

const log = (...messages) => {
  if (!isProduction()) {
    console.log(...messages);
  }
};

const error = (...messages) => {
  if (!isProduction()) {
    console.error(...messages);
  }
};

const getRandomAwaitPhrase = () => {
  const phrases = [
    'Wait a few seconds...',
    'Ща, ща, погодь...',
    'Э-эээ, та пагади ты ара, бл***!',
    'Подождите, идёт загрузка...',
    'Я не тормоз - я просто плавно мыслю. Ожидайте...',
    ':hourglass_flowing_sand: загрузка... :hourglass:',
  ];
  const randomIndex = Math.floor(Math.random() * phrases.length);
  return phrases[randomIndex];
};

const buildQueryString = (paramsObj = {}) => {
  return Object
    .entries(paramsObj)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
};

module.exports = {
  isValidRequest,
  isProduction,
  log,
  error,
  getRandomAwaitPhrase,
  buildQueryString,
};
