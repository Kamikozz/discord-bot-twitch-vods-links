const express = require('express');
const bodyParser = require('body-parser');
const twitchm3u8 = require('twitch-m3u8');

const { PORT } = require('./globals');
const {
  log, error, isValidDiscordRequest, isValidTwitchEventSubRequest, getRandomAwaitPhrase, ffmpeg,
} = require('./utils');
const { twitch, discord } = require('./api');
const { YoutubeAuthService, YoutubeService } = require('./services');
const Settings = require('./models/settings.model');
const store = require('./store');

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

const startLiveBroadcastRestream = async (twitchStreamerIdOrLogin, broadcastTitle) => {
  // NOTE: Once subprocess is spawned it will never stop until it shutdowns itself
  // probably TODO: save spawned subprocess and run .stopLiveBroadcastRestream()
  // by using subprocess.kill()

  // 1. Get valid LiveStreamId
  let { rtmpStreamId } = store.youtube;
  let rtmpStream;
  if (rtmpStreamId) {
    const liveStreamsListResult = await YoutubeService.liveStreamsList();
    const { items } = liveStreamsListResult;
    rtmpStream = items.find((item) => item.id === rtmpStreamId);
    rtmpStreamId = rtmpStream ? rtmpStream.id : null;
  }

  if (!rtmpStreamId) {
    const liveStreamsInsertResult = await YoutubeService.liveStreamsInsert();
    rtmpStream = liveStreamsInsertResult;
    rtmpStreamId = liveStreamsInsertResult.id;
    Settings.setYoutubeRtmpStreamId(rtmpStreamId); // save to db due to future usability
    store.youtube.rtmpStreamId = rtmpStreamId; // save to local db
  }

  // 2. Get new LiveBroadcastId
  const liveBroadcastsInsertResult = await YoutubeService.liveBroadcastsInsert({
    title: !broadcastTitle ? `Stream ${new Date().toLocaleString()}` : broadcastTitle,
    privacyStatus: 'private',
  });
  const liveBroadcastId = liveBroadcastsInsertResult.id;

  // 3. Bind LiveBroadcastId with LiveStreamId
  await YoutubeService.liveBroadcastsBind(liveBroadcastId, rtmpStreamId);

  // 4. Start re-stream
  const rtmpUri = `${rtmpStream.cdn.ingestionInfo.ingestionAddress}/${rtmpStream.cdn.ingestionInfo.streamName}`;
  const [mostQualityStream] = await twitchm3u8.getStream(twitchStreamerIdOrLogin.toLowerCase());
  const m3u8Playlist = mostQualityStream.url;
  ffmpeg.restream(m3u8Playlist, rtmpUri);

  return {
    liveBroadcastId,
    url: `https://youtu.be/${liveBroadcastId}`,
  };
};

app.post('/twitch', async (req, res) => {
  const { headers, body } = req;
  log(headers, body);
  if (!isValidTwitchEventSubRequest(req)) {
    return res.status(404).end();
  }

  const requestType = req.header('twitch-eventsub-message-type');
  const isVerificationRequest = requestType === 'webhook_callback_verification';
  if (isVerificationRequest) {
    log('Verifying Webhook');
    return res.status(200).end(body.challenge);
  }

  res.status(200).end();

  const subscriptionType = body.subscription.type;
  switch (subscriptionType) {
    case 'stream.online': {
      log('Stream Online Event');
      const { event } = body;
      const {
        broadcaster_user_id: twitchUserId,
        broadcaster_user_login: twitchUserLogin,
      } = event;

      const { url, liveBroadcastId } = await startLiveBroadcastRestream(twitchUserLogin);

      const [[{ title }], { items: [liveBroadcast] }] = await Promise.all([
        twitch.getStreams(twitchUserId),
        YoutubeService.liveBroadcastsList(liveBroadcastId),
      ]);
      liveBroadcast.snippet.title = title;
      YoutubeService.liveBroadcastsUpdate(liveBroadcast);
      discord.createMessage({ message: `${title} | ${url}` });
      break;
    }
    default: {
      log('Unhandled Subscription Event');
      break;
    }
  }
});

app.post('/discord', async (req, res) => {
  log('Got Discord Command: ', req.body);
  if (!isValidDiscordRequest(req)) {
    const errorText = 'Invalid request signature';
    error(errorText);
    return res.status(401).end(errorText);
  }

  const isPingRequest = req.body.type === 1; // https://discord.com/developers/docs/interactions/slash-commands#interaction-interactiontype
  if (isPingRequest) {
    log('Ping request');
    res.status(200).json({ type: 1 }); // https://discord.com/developers/docs/interactions/slash-commands#receiving-an-interaction
  } else {
    res.status(200).json({
      type: 5,
      data: { content: getRandomAwaitPhrase() },
    }); // https://discord.com/developers/docs/interactions/slash-commands#interaction-response-interactionresponsetype
  }

  const { application_id: applicationId, token } = req.body;
  const editDiscordBotReplyMessage = (data) => {
    discord.editFollowupMessage(applicationId, token, data);
  };
  const discordUserId = req.body.member.user.id;
  const payload = req.body.data;
  const command = payload.name;
  switch (command) {
    case 'auth_youtube': {
      log('Auth YouTube command');
      const youtubeAuthLink = YoutubeAuthService.createAuthLink();
      editDiscordBotReplyMessage({
        content: `**Click this link to authorize** ${youtubeAuthLink}`,
      });
      break;
    }
    case 'subscriptions': {
      log('Subscriptions command');
      const subscriptionsResult = await twitch.eventSub.getSubscriptions(
        twitch.eventSub.subscriptionsStatus.enabled,
      );
      log('> subscriptionsResult: ', subscriptionsResult);
      const { data: subscriptionsData } = subscriptionsResult;
      if (!subscriptionsData.length) {
        return editDiscordBotReplyMessage({ content: 'Нет активных подписок' });
      }
      const uniqueUserIds = new Set();
      subscriptionsData
        .forEach(({ condition }) => uniqueUserIds.add(condition.broadcaster_user_id));
      const usersInformation = await twitch.getUsersInformationByIds(Array.from(uniqueUserIds));
      const result = usersInformation.map((user) => `- ${user.display_name}`).join('\n');
      editDiscordBotReplyMessage({ content: `Текущие подписки:\n${result}` });
      break;
    }
    case 'subscribe': {
      const { options } = payload;
      const [{ value: searchByName }] = options;
      log('Subscribe command', `got param value: ${searchByName}`);
      if (!searchByName) {
        return editDiscordBotReplyMessage({
          content: 'Некорректное использование команды /subscribe: параметр пользователя пуст',
        });
      }

      try {
        await twitch.subscribe(searchByName);
      } catch (e) {
        error(e);
        return editDiscordBotReplyMessage({ content: `Subscribing error: ${e.message}` });
      }

      return editDiscordBotReplyMessage({
        content: `<@${discordUserId}> подписался на ${searchByName}`,
        allowed_mentions: {
          users: [discordUserId],
        },
      });
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

      try {
        await twitch.unsubscribe(searchByName);
      } catch (e) {
        error(e);
        return editDiscordBotReplyMessage({ content: `Unsubscribing error: ${e.message}` });
      }

      return editDiscordBotReplyMessage({
        content: `<@${discordUserId}> отписался от ${searchByName}`,
        allowed_mentions: {
          users: [discordUserId],
        },
      });
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

app.get('/youtube', async (req, res) => {
  const { code = '' } = req.query;
  if (!code.length) {
    res.status(404).end();
    return;
  }
  const isYoutubeAuthCompleted = await YoutubeAuthService.exchangeSecretsForAccessToken(code);
  const interactionResult = isYoutubeAuthCompleted ? 'success' : 'failed';
  discord.createMessage({
    message: `[YouTube] Authorization **${interactionResult}**`,
  });
  res.status(200).end(`
    <html>
      <head>
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: black;
          }
          .success { color: green; }
          .failed { color: red; }
        </style>
      </head>
      <body>
        <div style="font-size: 25px;">
          <p class="${interactionResult}">${interactionResult}</p>
          <p style="color: white;">You can close this window</p>
        </div>
      </body>
    </html>
  `);
  log(store);
});

module.exports = {
  init: () => {
    app.listen(PORT, () => {
      log(`[Express] App listening... ${PORT}`);
    });
  },
};
