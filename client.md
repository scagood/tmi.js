# Basic twitch chat client interface
A quick little api for TwitchTV's websockets in browser

In order to use this you have to:
1. Clone this repo (or just download tmi.js)
2. Add the following to your html:
 ```html
 <script src="/path/to/tmi.js"></script>
```
3. Create your magical js

## Options
```javascript
var options = {
    "debug": true,                    // True => show debug messages in console
    "channels": [],                   // A list of channels to join initially
    "relay": "ws://relay.host.name"   // The server's socket string
}
```

Auto rejoin is currently not working

## Functions
```javascript
var irc = new twitchIRC(username, oauth, options);
irc.on("event", callback);      // Event callback function
irc.close() = ()
irc.join("channel");             // Join "channel"
irc.part("channel");             // Leave "channel"
irc.send("channel", "message");  // Send "message" to "channel"
irc.sendRaw("message");          // Send "message" directly to twitch
irc.whisper("user", "message");  // Whisper "message" to "user"
```

## Variables
```javascript
this.username;  // Nick currently connected using
this.connected; // A list of channels currently connected to
```

## Events
### "raw"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("raw", function (rawMessage) {
    /**
     * rawMessage: The raw message recieved from the server
    **/
});
```

### "join"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("join", function (channel, user) {
    /**
     * channel: Is the channel in which the event applies to
     * user:    Is the user who joined the channel
    **/
});
```

### "part"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("part", function (channel, user) {
    /**
     * channel: Is the channel in which the event applies to
     * user:    Is the user who parted the channel
    **/
});
```

### "mode"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("mode", function (channel, user, message) {
    /**
     * channel: Is the channel in which the event applies to
     * user:    Is the user who the message applies to
     * message: The
    **/
});
```

### "roomstate"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("roomstate", function (channel, tags) {
    /**
     * channel: Is the channel in which the event applies to
     * tags:    The array of tags sent with the message
    **/
});
```

### "userstate"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("userstate", function (channel, tags) {
    /**
     * channel: Is the channel in which the event applies to
     * tags:    The array of tags sent with the message
    **/
});
```

### "message"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("message", function (channel, user, message, tags) {
    /**
     * channel: Is the channel in which the event applies to
     * user:    Is the user who sent the message
     * message: Is the message the user sent
     * tags:    The array of tags sent with the message
    **/
});
```

### "usertimed"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("usertimed", function (channel, user, banDuration, tags) {
    /**
     * channel:     Is the channel in which the event applies to
     * user:        Is the user who was timed out
     * banDuration: Is the length of time (in seconds) of the ban
     * tags:        The array of tags sent with the message
    **/
});
```

### "userban"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("userban", function (channel, message, tags) {
    /**
     * channel: Is the channel in which the event applies to
     * user:    Is the user who was banned out
     * tags:    The array of tags sent with the message
    **/
});
```

### "clearchat"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("clearchat", function (channel) {
    /**
     * channel: Is the channel in which the event applies to
    **/
});
```

### "action"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("action", function (channel, user, message, tags) {
    /*\
     * channel: Is the channel which the user sent the message to
     * user:    Is the user who sent the message
     * message: Is the message the user sent
     * tags:    The array of tags sent with the message
    \*/
});
```

### "whisper"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("whisper", function (to, from, message, tags) {
    /**
     * to:      Is the user which the whisper is meant for
     * from:    Is the user which the whisper was sent from
     * message: Is the message the user sent
     * tags:    The array of tags sent with the message
    **/
});
```

### "relayerror"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("relayerror", function (nick, message) {
    /**
     * nick:    Is the bot's username
     * message: Is the error the bot sent
    **/
});
```

### "botnick"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("botnick", function (nick) {
    /**
     * nick: Is the bot's username
    **/
});
```

### "notice"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("notice", function (channel, message, tags) {
    /**
     * channel: Is the channel in which the event applies to
     * message: Is the notice server sent
     * tags:    The array of tags sent with the message
    **/
});
```

### "welcome"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("welcome", function (command, message) {
    /**
     * command: Command number
     * message: Commands message
    **/
});
```

### "all"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("all", function (message) {
    /**
     * message: Is an array with all events and fields in
    **/
});
```

### "close"
```JavaScript
var irc = new twitchIRC(username, oauth, options);
irc.on("close");

```

## Example

```javascript
// Declare your username, auth_token and options
var username = 'scagood';
var oauth = 'abcdefghijklmnopqrstuvwxyz1234'; // This is totally valid :')
var bot = new twitchIRC(username, oauth, {
  "channels": ["#scagood"], // Immediately connect to #scagood
});

// Recieve messages
bot.on("message", function (channel, user, message) {
  // Split the message into words
  var words = message.split(" ");
  // Check to see if the first word it 'hello'
  if (words[0] === "hello") {
    // Say hi to the person who said hello
    bot.send(channel, "Hello " + user + "!");
  }
});
```
