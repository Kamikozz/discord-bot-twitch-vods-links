require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const { PORT, SUBSCRIPTION_LEASE_SECONDS } = require('./globals');
const { log, error, isValidRequest } = require('./utils');
const twitch = require('./api/twitch');
const discord = require('./api/discord');
const mongodb = require('./db');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('<b>For more information <a href="https://github.com/kamikozz">@see</a></b>');
});

app.get('/twitch', (req, res) => {
  log('Got Twitch Confirmation', req.query);
  res
    .header('Content-Type', 'text/plain')
    .status(200)
    .send(req.query['hub.challenge']);
});

app.post('/twitch', async (req, res) => {
  log(req.body);
  res.status(200).send('OK');
  if (req.body.data.length) {
    log('Stream Change Events');
  } else {
    log('Stream Offline Event');
    const [userVideos, messages] = await Promise.all([
      twitch.getUserVideos(),
      discord.getMessages({ channelId: process.env.DISCORD_BOT_CHANNEL_ID }),
    ]);
    const [lastVideo] = userVideos;
    const { thumbnail_url } = lastVideo;
    const vodUrl = `https://vod-secure.twitch.tv/${thumbnail_url.split('/')[5]}/chunked/index-dvr.m3u8`;
    const [lastMessage] = messages;
    const isAlreadyPosted = lastMessage.content.includes(vodUrl);
    if (!isAlreadyPosted) {
      const { title } = lastVideo;
      const discordObj = {
        title,
        imageUrl: thumbnail_url.replace('%{width}', '600').replace('%{height}', '350'),
        vodUrl,
      };
      discord.sendToDiscordFormatted(discordObj);
    }
  }
});

app.post('/discord', async (req, res) => {
  log('Got Discord Command: ', req.body);
  if (!isValidRequest(req)) {
    const errorText = 'Invalid request signature';
    error(errorText);
    return res.status(401).end(errorText);
  }

  const isPingRequest = req.body.type === 1; // https://discord.com/developers/docs/interactions/slash-commands#interaction-interactiontype
  if (isPingRequest) {
    log('Ping request');
    return res.status(200).end(JSON.stringify({ type: 1 })); // https://discord.com/developers/docs/interactions/slash-commands#receiving-an-interaction
  }

  res.status(200).end();

  const payload = req.body.data;
  const command = payload.name;
  switch (command) {
    case 'subscribe': {
      log('Subscribe');
      const userId = req.body.member.user.id;
      twitch.subscribe({
        leaseSeconds: SUBSCRIPTION_LEASE_SECONDS,
        callback: () => {
          const newDateTime = new Date(Date.now() + SUBSCRIPTION_LEASE_SECONDS * 1000).toLocaleString('ru-RU');
          discord.createMessage({
            message: `<@${userId}> подписка обновлена и закончится ${newDateTime}`,
            allowedUsersMentionsIds: [userId],
          });
        },
      });
      break;
    }
    case 'auth': {
      log('Auth command');
      const authResult = await twitch.auth({ clientId: process.env.TWITCH_CLIENT_ID });
      log('Result of slash command auth:', authResult);
      if (typeof authResult === 'string') {
        discord.createMessage({ message: 'При переавторизации Twitch произошла ошибка' });
      } else {
        discord.createMessage({ message: 'Переавторизация Twitch прошла успешно' });
      }
      break;
    }
    default: {
      error('No handler for command: ', command);
      break;
    }
  }
});

app.get('/auth', async (req, res) => {
  log('Got Twitch Auth', req.query);
  const { clientId } = req.query;
  const authResult = await twitch.auth({ clientId });
  log('Result of endpoint auth:', authResult);
  res.header('Content-Type', 'text/plain');
  if (typeof authResult === 'string') {
    res
      .status(401)
      .end(authResult);
  } else {
    res
      .status(200)
      .end('OK');
  }
});

// // FIXME: remove it
// mongodb.init(async () => {
//   // Settings.setTwitchReauthId('sdfd');
//   // Settings.subscribe('qwe', 'id1231232');
//   // Settings.unsubscribe('qwe');
// });

mongodb.init(() => {
  app.listen(PORT, () => {
    log(`[Express] App listening... ${PORT}`);
  });
});
