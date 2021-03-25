# Discord Bot for Twitch.tv users' Twitch.tv videos' links generator
*these links are chunked index-dvr.m3u8 files, that can be opened in Safari on iOS or within Chrome plugin `Native HLS Playback`*

## ⚠ Outdated information ⚠

## Stack
- Node.js without `node-fetch`
  - express framework
- [Mongodb's Atlas Cloud](https://cloud.mongodb.com/) Solution (as universal storage for scheduled events' ids for `SchedulerAPI`)
  - Mongoose (as ORM MongoDB)
- [Scheduler API](https://schedulerapi.com/) (as HTTP webhook service for scheduled tasks like resubscribe or reauthorize)
- [Discord API](https://discord.com/developers) (as UI)
- [Twitch API](https://dev.twitch.tv/) (as service for twitch user's streams' events, authentication & subscriptions)
- [Heroku](https://dashboard.heroku.com/) (to deploy and store env variables (or you can use your deployment, but you need to set env vars on your own as listed below))

## Environment variables (and `globals.js`)
- MODE=dev/production
- HOST_URL=https://path.to.your.deployment.without.closing.slash
- TWITCH_CLIENT_ID=<https://dev.twitch.tv/console>
- TWITCH_CLIENT_SECRET=<https://dev.twitch.tv/console>
- DISCORD_WEBHOOK_PATH=/api/webhooks/**webhook or application id**/<webhook_token>
- DISCORD_BOT_TOKEN=<navigate to https://discord.com/developers/applications and choose your application -> Bot>
- DISCORD_APPLICATION_PUBLIC_KEY=<also retrieves on the https://discord.com/developers/applications page>
- DISCORD_BOT_AVATAR_URL=https://link.to.your.custom.bot.avatar/photo.jpeg
- DISCORD_BOT_CHANNEL_ID=<channel_id where bot will write messages by .createMessage>
- SCHEDULER_API_KEY=<https://app.schedulerapi.com/admin>
- MONGODB_URI=**uri to make connect with your mongodb**

*process.env & globals.js store all of the needed variables*

## Available commands:
- **/auth** - to *generate* Twitch `access_token` using `ClientId` & `ClientSecret` and *create scheduled task to reauthorize in `TWITCH_TOKEN_LEASE_SECONDS`* (max available days until token lease ~ 60) https://dev.twitch.tv/docs/authentication#types-of-tokens
- **/logout** - COMING NOT SO SOON
- **/subscribe <twitch_username>** - to *create* Twitch subscription on user's streams' events and *create scheduled task to resubscribe in `SUBSCRIPTION_LEASE_SECONDS`* (max available 10 days) https://dev.twitch.tv/docs/api/webhooks-reference#subscribe-tounsubscribe-from-events `hub.lease_seconds`
- **/unsubscribe <twitch_username>** - to *unsubscribe* from Twitch user's streams' events and *remove scheduled task to resubscribe*
- **/subscriptions** - to *get* current subscriptions of the user

## To create `DISCORD_WEBHOOK_URL` env param
1. Go to your `Discord` channel in which you want to write messages.
2. Press `gear` icon -> *Integration* -> *Webhooks* -> *Create new webhook*.
3. Configurate it as you wish.
4. Set up your `DISCORD_WEBHOOK_URL` env to webhook url you just created.
* it should look like `/api/webhooks/.../...../` (without schema https & domain)

## To use [Slash Commands](https://discord.com/developers/docs/interactions/slash-commands)
1. Create an Application on [Developer Portal](https://discord.com/developers/applications/)
2. Create Bot on Developer Portal
3. Paste this URL into `https://discord.com/oauth2/authorize?client_id=<YOUR_APPLICATION_CLIENT_ID>&scope=applications.commands+bot` web browser's address and add this bot to your channel
4. Create new **slash command** by `POST` request to `https://discord.com/api/v8/applications/<YOUR_APPLICATION_CLIENT_ID>/commands`
with body:
```json
{
    "name": "permissions",
    "description": "Get or edit permissions for a user or a role",
    "options": [
        {
            "name": "user",
            "description": "Get or edit permissions for a user",
            "type": 2
        },
        {
            "name": "role",
            "description": "Get or edit permissions for a role",
            "type": 2
        }
    ]
}
```
and **Authorization header** via `Client credentials` or `Bot credentials`

*For authorization, you can use either your bot token*
```
"Authorization": "Bot 123456"
```
*or a client credentials token for your app with the applications.commmands.update scope*
```
"Authorization": "Bearer abcdefg"
```
5. Handle [receiving interaction](https://discord.com/developers/docs/interactions/slash-commands#receiving-an-interaction) for **Slash commands**:
* 5.1. `In your application in the Developer Portal, there is a field on the main page called "Interactions Endpoint URL". If you want to receive Interactions via outgoing webhook, you can set your URL in this field. In order for the URL to be valid, you must be prepared for two things ahead of time:`

* 5.2. When you attempt to save a URL, `Discord` will send a `POST` request to that URL with a `PING` payload. The `PING` payload has a `type: 1`. So, to properly ACK the payload, return a `200` reponse with a payload of type: 1:`
```js
res.status(200).end({ type: 1 });
```

* 5.3. Full example of `Node.js` code with `express`
```js
app.post('/<YOUR_ENDPOINT_CONFIGURED_ON_DEV_CENTER>', (req, res) => {
  const isValidRequest = utils.isValidRequest(
    req.get('X-Signature-Ed25519'),
    req.get('X-Signature-Timestamp'),
    req.rawBody,
  );
  if (isValidRequest) {
    if (req.body.type === 1) {
      res.status(200).end({ type: 1 });
    } else {
      // TODO
    }
  } else {
    // otherwise need to send 401 status code w/out response text
    res.status(401).end('invalid request signature');
  }
});
```
`isValidRequest` is function which implements logic written [here](https://discord.com/developers/docs/interactions/slash-commands#security-and-authorization)

* 5.4. Handle your own commands in // TODO section
```js
    } else {
      // TODO
    }
```
