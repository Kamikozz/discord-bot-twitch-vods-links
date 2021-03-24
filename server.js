require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const { PORT } = require('./globals');
const { log, error, isValidRequest, getRandomAwaitPhrase } = require('./utils');
const twitch = require('./api/twitch');
const discord = require('./api/discord');
const scheduler = require('./api/scheduler');
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

  res.status(200).end(JSON.stringify({
    type: 5,
    data: { content: getRandomAwaitPhrase() },
  })); // https://discord.com/developers/docs/interactions/slash-commands#interaction-response-interactionresponsetype

  const { application_id, token } = req.body;
  const editDiscordBotReplyMessage = (data) => discord.editFollowupMessage(application_id, token, data);
  const discordUserId = req.body.member.user.id;
  const payload = req.body.data;
  const command = payload.name;
  switch (command) {
    case 'subscriptions': {
      log('Subscriptions command');
      const obj = {}; // store { 'userId': '2021-11-123:1321' }
      const subscriptionsResult = await twitch.getSubscriptions();
      let { data: subscriptions } = subscriptionsResult;
      if (!subscriptions.length) {
        return editDiscordBotReplyMessage({ content: 'Нет активных подписок' });
      }
      const userIds = subscriptions.map(({ topic, expires_at }) => {
        const [_, userId] = topic.split('user_id=');
        obj[userId] = expires_at;
        return userId;
      });
      const usersInformation = await twitch.getUsersInformationByIds(userIds);
      const result = usersInformation
        .map(({ id, display_name }) => {
          const expiresAt = obj[id];
          return `- ${display_name} | ${new Date(expiresAt).toLocaleString('ru-RU')}`;
        })
        .join('\n');
      editDiscordBotReplyMessage({ content: `Текущие подписки:\n${result}` });
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
        editDiscordBotReplyMessage({
          content: `При обновлении подписки на ${searchByName} что-то пошло не так`,
        });
      } else {
        editDiscordBotReplyMessage({
          content: `<@${discordUserId}> подписался на ${searchByName}`,
          allowed_mentions: {
            users: [discordUserId],
          },
        });
      }
      break;
    }
    case 'unsubscribe': {
      const { options } = payload;
      const [{ value: searchByName }] = options;
      log('Unsubscribe command', `got param value: ${searchByName}`);
      if (!searchByName) {
        return editDiscordBotReplyMessage({
          content: 'Некорректное использование команды /unsubscribe: параметр пользователя пуст',
        });
      }

      const [userInformation] = await twitch.getUsersInformationByNames([searchByName]);
      if (!userInformation) {
        return editDiscordBotReplyMessage({
          content: `Пользователя ${searchByName} не существует`,
        });
      }
      const { id, login } = userInformation;

      const { twitchSubscriptions = {} } = await Settings.getSettings() || {};
      const scheduledRenewalSubscriptionId = twitchSubscriptions[login];
      if (!scheduledRenewalSubscriptionId) {
        return editDiscordBotReplyMessage({
          content: `Вы не подписаны на ${searchByName}`,
        });
      }

      Promise.all([
        scheduler.cancelSchedule(scheduledRenewalSubscriptionId),
        twitch.unsubscribe(id),
      ]).then(async () => {
        await Settings.unsubscribe(login);
        editDiscordBotReplyMessage({
          content: `<@${discordUserId}> отписался от ${searchByName}`,
          allowedUsersMentionsIds: [discordUserId],
        });
      }).catch((err) => {
        error(err);
        editDiscordBotReplyMessage({
          content: `Пользователь ${searchByName} найден, но произошла ошибка отписки от Scheduler или Twitch`,
        });
      });
      break;
    }
    case 'auth': {
      log('Auth command');
      const authResult = await twitch.auth({ clientId: process.env.TWITCH_CLIENT_ID });
      log('Result of slash command auth:', authResult);
      editDiscordBotReplyMessage({
        content: typeof authResult === 'string'
          ? 'При переавторизации Twitch произошла ошибка'
          : 'Переавторизация Twitch прошла успешно',
      });
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
