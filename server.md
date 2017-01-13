# Basic twitch chat client relay server
A relay server for use with the client version of this module

In order to use this you have to:
1. Clone this repo (or just download tmi.relay.js)
2. Create a 'relay.json' file
3. Run the package ```npm start``` or ```node tmi.relay.js```

Example 'relay.json'
```json
{
    "host": "scagood.co.uk",
    "bots": {
        "scabot": {
            "name": "scabot",
            "auth": "abcdefghijklmnopqrstuvwxyz1234",
            "cmds": ["me", "mods", "ban", "unban", "timeout", "untimeout"],
            "users": ["scagood"]
        }
    }
}
```

Example 'relay.json' with comments
```json
{
    "log": false,
    "_comment_log": "Will the program write all messages to console",
    "_comment_log_default": false,
    "proxy": false,
    "_comment_proxy": "Can people get a direct proxy via ws:/site.site/~proxy",
    "_comment_proxy_default": false,
    "relay": false,
    "_comment_relay": "Can people get a readonly relay via ws:/site.site/~relay",
    "_comment_relay_default": false,
    "host": "scagood.co.uk",
    "_comment_host": "The host to report as",
    "port": 80,
    "_comment_port": "Port to listen on",
    "_comment_port_default": 80,
    "bots": {
        "_default": "scabot",
        "_comment__default": "The first bot in the 'bots' array if it's an object it's treated as a bot",
        "scabot": {
            "name": "<- your bot's name ->",
            "host": "<- your bot's host name ->",
            "_comment_host": "Defaults to (bots.bot.name + '.bot.' + host)",
            "auth": "<- Your bot's oauth token ->",

            "cmds": [
                "<- Allowed command #1 ->",
                "<- Allowed command #2 ->",
            ],
            "_comment_cmds": "An array of commands the users are allowed",
            "_comment_cmds_default": [],

            "users": true,
            "users": [
                "<- Allowed username #1 ->",
                "<- Allowed username #2 ->"
            ],
            "_comment_users": [
                "'true' means anyone can use it",
                "an array means the given users can use the bot's name"
            ],
            "_comment_users_default": [],
        }
    },
    "_comment_bots": "If not set or empty it defaults to a relay"
}
```
