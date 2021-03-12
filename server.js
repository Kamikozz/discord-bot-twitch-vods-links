require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const { PORT, SUBSCRIPTION_LEASE_SECONDS } = require('./globals');
const { log, error, isValidRequest } = require('./utils');
const twitch = require('./twitch');
const discord = require('./discord');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// GET: /
app.get('/', (req, res) => {
  res.send('<b>For more information <a href="https://github.com/kamikozz">@see</a></b>');
});

// POST: /twitch
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

// GET: /twitch
app.get('/twitch', (req, res) => {
  log('Got Twitch Confirmation', req.query);
  res
    .header('Content-Type', 'text/plain')
    .status(200)
    .send(req.query['hub.challenge']);
});

// POST: /discord
app.post('/discord', (req, res) => {
  log('Got Discord Command: ', req.body);
  if (isValidRequest(req)) {
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
