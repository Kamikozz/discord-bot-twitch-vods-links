require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const utils, { isProduction } = require('./utils');
const twitch = require('./twitch');
const discord = require('./discord');

const app = express();
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<b>For more information <a href="https://github.com/kamikozz">@see</a></b>');
});

app.post('/twitch', (req, res) => {
  if (!isProduction()) {
    console.log(req.body);
  }
  res.status(200).send('OK');
  if (req.body.data.length) {
    if (!isProduction()) {
      console.log('Stream Change Events');
    }
    // discord.sendToDiscord(req.body);
  } else {
    if (!isProduction()) {
      console.log('Stream Offline Event');
    }
    twitch.getUserVideos();
  }
});

app.get('/twitch', (req, res) => {
  if (!isProduction()) {
    console.log('Got Twitch Confirmation', req.query);
  }
  res
    .header('Content-Type', 'text/plain')
    .status(200)
    .send(req.query['hub.challenge']);
  // discord.sendToDiscord(req.query);
});

app.post('/discord', (req, res) => {
  if (!isProduction()) {
    console.log('Got Discord Command: ', req.body);
  }
  const isValidRequest = utils.isValidRequest(
    req.get('X-Signature-Ed25519'),
    req.get('X-Signature-Timestamp'),
    JSON.stringify(req.body),
  );
  if (isValidRequest) {
    res.status(200).end(JSON.stringify({ type: 1 }));
    if (req.body.type !== 1) {
      const command = req.body.data.name;
      switch (command) {
        case 'subscribe': {
          if (!isProduction()) {
            console.log('Subscribe');
          }
          const userId = req.body.member.user.id;
          const subscriptionLeaseSeconds = 864000;
          twitch.subscribe({
            leaseSeconds: subscriptionLeaseSeconds,
            callback: () => {
              const newDateTime = new Date(Date.now() + subscriptionLeaseSeconds * 1000).toLocaleString('ru-RU');
              discord.createMessage({
                message: `<@${userId}> подписка обновлена и закончится ${newDateTime}`,
                allowedUsersMentionsIds: [userId],
              });
            },
          });
          break;
        }
        default: {
          if (!isProduction()) {
            console.error('No handler for command: ', command);
          }
          break;
        }
      }
    }
  } else {
    res.status(401).end('Invalid request signature');
  }
});

app.listen(PORT, () => {
  if (!isProduction()) {
    console.log(`App listening...${PORT}`);
  }
});
