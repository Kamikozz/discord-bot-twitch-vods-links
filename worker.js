const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');

const app = express();
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const sendToDiscord = (json) => {
  const options = {
    hostname: 'discord.com',
    path: '',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  const req = https.request(options);
  req.write(JSON.stringify({
    "content": JSON.stringify(json),
    "avatar_url": 'https://picsum.photos/200/300',
  }));
  req.end();
};

app.post('/twitch', (req, res) => {
  console.log(req.body);
  res.status(200).send('OK');
  sendToDiscord(req.body);
});

// {
//   "hub.callback": "https://discord.com",
//   "hub.mode": "subscribe",
//   "hub.topic": "https://api.twitch.tv/helix/streams?user_id=",
//   "hub.lease_seconds": 864000
// }

app.listen(PORT, () => {
  console.log(`App listening...${PORT}`);
});
