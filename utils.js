const { spawn } = require('child_process');
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

function buildQueryString(paramsObj = {}) {
  return Object
    .entries(paramsObj)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

const ffmpeg = {
  restream(m3u8Playlist, rtmpUri) {
    const child = spawn('ffmpeg', [
      '-fflags',
      '+igndts',
      '-hide_banner',
      '-i',
      m3u8Playlist,
      '-c',
      'copy',
      '-f',
      'flv',
      rtmpUri,
    ]);

    // use child.stdout.setEncoding('utf8'); if you want text chunks
    child.stdout.on('data', (chunk) => {
      // data from standard output is here as buffers
      log(`[FFMPEG] ${chunk.toString('utf8')}`);
    });

    child.stderr.on('data', () => {
      // console.log(chunk.toString('utf8'));
    });

    child.on('close', (code) => {
      log(`[FFMPEG] Child process exited with code ${code}`);
    });
  },
};

module.exports = {
  isValidRequest,
  isProduction,
  log,
  error,
  getRandomAwaitPhrase,
  buildQueryString,
  ffmpeg,
};
