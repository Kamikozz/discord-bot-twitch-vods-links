const express = require('express');
const bodyParser = require('body-parser');
const utils = require('./utils');
const twitch = require('./twitch');
const discord = require('./discord');

const app = express();
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/twitch', (req, res) => {
  console.log(req.body);
  res.status(200).send('OK');
  discord.sendToDiscord(req.body);
  if (req.body.data.length) {
    console.log('Stream Change Events');
  } else {
    console.log('Stream Offline Event');
    twitch.getUserVideos();
  }
});

app.get('/twitch', (req, res) => {
  console.log('Got Twitch Confirmation');
  console.log(req.query);
  res
    .header('Content-Type', 'text/plain')
    .status(200)
    .send(req.query['hub.challenge']);
  discord.sendToDiscord(req.query);
});

app.post('/discord', (req, res) => {
  console.log('Got Discord Command: ', req.body);
  const isValidRequest = utils.isValidRequest(
    req.get('X-Signature-Ed25519'),
    req.get('X-Signature-Timestamp'),
    req.rawBody,
  );
  if (isValidRequest) {
    if (req.body.type === 1) {
      console.log(req.headers);
    } else {
      console.log('WTF');
    }
  } else {
    res.status(401).end('invalid request signature');
  }
});

app.listen(PORT, () => {
  console.log(`App listening...${PORT}`);
});
