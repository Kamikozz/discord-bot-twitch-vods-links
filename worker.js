const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const credentials = require('./credentials');

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
  sendToDiscord(req.body);
  if (req.body.data.length) {
    console.log('Stream Change Events');
  } else {
    console.log('Stream Offline Event');
    getUserVideos();
  }
});

app.get('/twitch', (req, res) => {
  console.log('Got Twitch Confirmation');
  console.log(req.query);
  res
    .header('Content-Type', 'text/plain')
    .status(200)
    .send(req.query['hub.challenge']);
  sendToDiscord(req.query);
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

const getUserVideos = (userId = '') => {
  const options = {
    hostname: 'api.twitch.tv',
    path: `/helix/videos?user_id=${userId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${credentials.twitch.token}`,
      'Client-Id': credentials.twitch.clientId,
    },
  };
  let responseData = '';
  const req = https.get(options, (res) => {
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    res.on('end', () => {
      const parsedObj = JSON.parse(responseData);
      const lastVideo = parsedObj.data[0];
      const mappedObj = {
        title: lastVideo.title,
        thumbnail_url: lastVideo.thumbnail_url,
      };
      const discordObj = {
        title: mappedObj.title,
        imageUrl: mappedObj.thumbnail_url
          .replace('%{width}', '600')
          .replace('%{height}', '350'),
        vodUrl: `https://vod-secure.twitch.tv/${mappedObj.thumbnail_url.split('/')[5]}/chunked/index-dvr.m3u8`,
      };
      console.dir(discordObj);
      sendToDiscord(discordObj);
    });
  });
};

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