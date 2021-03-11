require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const { PORT, SUBSCRIPTION_LEASE_SECONDS } = require('./globals');
const utils = require('./utils');
const { log, error } = require('./utils');
const twitch = require('./twitch');
const discord = require('./discord');

const app = express();
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('<b>For more information <a href="https://github.com/kamikozz">@see</a></b>');
});

app.post('/twitch', async (req, res) => {
  log(req.body);
  res.status(200).send('OK');
  if (req.body.data.length) {
    log('Stream Change Events');
    // discord.sendToDiscord(req.body);
  } else {
    log('Stream Offline Event');
    const userVideos = await twitch.getUserVideos();
    const [lastVideo] = userVideos;
    const discordObj = {
      title: lastVideo.title,
      imageUrl: lastVideo.thumbnail_url
        .replace('%{width}', '600')
        .replace('%{height}', '350'),
      vodUrl: `https://vod-secure.twitch.tv/${lastVideo.thumbnail_url.split('/')[5]}/chunked/index-dvr.m3u8`,
    };
    discord.sendToDiscordFormatted(discordObj);
  }
});

app.get('/twitch', (req, res) => {
  log('Got Twitch Confirmation', req.query);
  res
    .header('Content-Type', 'text/plain')
    .status(200)
    .send(req.query['hub.challenge']);
  // discord.sendToDiscord(req.query);
});

app.post('/discord', (req, res) => {
  log('Got Discord Command: ', req.body);
  const isValidRequest = utils.isValidRequest(req);
  if (isValidRequest) {
    res.status(200).end(JSON.stringify({ type: 1 }));
    if (req.body.type !== 1) {
      const command = req.body.data.name;
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
        default: {
          error('No handler for command: ', command);
          break;
        }
      }
    }
  } else {
    res.status(401).end('Invalid request signature');
  }
});

app.listen(PORT, () => {
  log(`App listening...${PORT}`);
});
