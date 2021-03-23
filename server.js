require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const { PORT } = require('./globals');
const { log, error, isValidRequest } = require('./utils');
const twitch = require('./api/twitch');
const discord = require('./api/discord');
const mongodb = require('./db');
const Settings = require('./models/settings.model');

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
  const { userId } = req.query;
  log(req.body, userId);
  res.status(200).send('OK');
  if (!userId) return;
  if (req.body.data.length) {
    log('Stream Change Events');
  } else {
    log('Stream Offline Event');
    const [userVideos, messages] = await Promise.all([
      twitch.getUserVideos(userId),
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
    case 'subscriptions': {
      log('Subscriptions command');
      const subscriptionsResult = await twitch.getSubscriptions();
      let { data: subscriptions } = subscriptionsResult;
      const userIds = subscriptions.map(({ topic }) => {
        const [_, userId] = topic.split('user_id=');
        return userId;
      });
      const usersInformation = await twitch.getUsersInformationByIds(userIds);
      const result = subscriptions
        .map(({ expires_at }, index) => {
          const { display_name } = usersInformation[index];
          return `- ${display_name} | ${new Date(expires_at).toLocaleString('ru-RU')}`;
        })
        .join('\n');
      discord.createMessage({ message: `Текущие подписки:\n${result}` });
      break;
    }
    case 'subscribe': {
      const { options } = payload;
      const [{ value: searchByName }] = options;
      log('Subscribe command', `got param value: ${searchByName}`);
      if (!searchByName) return;

      const resubscribeResult = await twitch.resubscribe({
        clientId: process.env.TWITCH_CLIENT_ID,
        searchByName,
      });
      log('Result of slash command resubscribe:', resubscribeResult);
      if (typeof resubscribeResult === 'string') {
        discord.createMessage({
          message: `При обновлении подписки на ${searchByName} что-то пошло не так`,
        });
      } else {
        const discordUserId = req.body.member.user.id;
        discord.createMessage({
          message: `<@${discordUserId}> подписался на ${searchByName}`,
          allowedUsersMentionsIds: [discordUserId],
        });
      }
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
  log('Got Twitch reauth', req.query);
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

app.get('/resubscribe', async (req, res) => {
  log('Got Twitch user resubscribe', req.query);
  const { clientId, userId, login } = req.query;

  const resubscribeResult = await twitch.resubscribe({ clientId, userId, login });
  log('Result of endpoint resubscribe:', resubscribeResult);
  res.header('Content-Type', 'text/plain');
  if (typeof resubscribeResult === 'string') {
    res
      .status(401)
      .end(resubscribeResult);
  } else {
    res
      .status(200)
      .end('OK');
  }
});

mongodb.init(async () => {
  const settings = await Settings.getSettings() || {};
  process.env.TWITCH_TOKEN = settings.twitchToken;

  app.listen(PORT, () => {
    log(`[Express] App listening... ${PORT}`);
  });
});
