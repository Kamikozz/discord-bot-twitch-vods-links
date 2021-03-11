# Discord Bot for Twitch.tv users' Twitch.tv videos' links generator

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