# LND-Tools: A proxy tool for LND

## Requirements

* Node.JS v16


## Usage

For these instructions, I will use the dev command (i.e. `lnd-tools.js`), but if using a
binary, you should replace `lnd-tools.js` with your appropriate binary file.


### Server
To run your server, you'll need to create an authentication private/public key pair.
```
./lnd-tools.js keygen
```

This will output a private and public key pair to `auth.key` and `auth.pub`. By default, it will create and place the files in `$HOME/.lnd-tools`.

The public key (auth.pub) will be used by the server to authenticate requests.
The private key (auth.key) will be used from a client (either the included client or your custom external service) to sign requests to the server.

Start the server with
```
./lnd-tools.js serve
```
> The above command uses several defaults and creates a data directory in `$HOME/.lnd-tools`. See the [Configuration](#configuration) section below

### Client
Once the server is running, you can use the client to:
- Add/Remove/Get whitelist entries for accepting channel open requests.
- Configure a custom response when denying a channel open request.

Examples:

Get all whitelist entries
```
./lnd-tools.js client -k auth.key whitelist list
```

Add a new public key to the whitelist
```
./lnd-tools.js client -k auth.key whitelist add 037f1bbdc42d775c0d3ac4cbae2a676065d98128758718bbbc98c4d0616f7b5eb4
```

Remove a public key from the whitelist
```
./lnd-tools.js client -k auth.key whitelist rm 037f1bbdc42d775c0d3ac4cbae2a676065d98128758718bbbc98c4d0616f7b5eb4
```

Get the current channel request reject message
```
./lnd-tools.js client -k auth.key config getRejectMessage
```

Set a new channel request reject message
```
./lnd-tools.js client -k auth.key config setRejectMessage "This is the new message"
```

Remove the custom channel request reject message. This will result in the default message being shown.
```
./lnd-tools.js client -k auth.key config rmRejectMessage
```

## Dev & Debug

Clone the repo then run:
```
cd lnd-tools
npm install
```

I would recommend using [Polar](https://lightningpolar.com) and set up a network. Choose an LND node to be "your" node and point `--lnddir` to its directory (e.g. `--lnddir $HOME/.polar/networks/1/volumes/lnd/alice`)

Execute the program by running
```
./lnd-tools.js <...args>
```

## Configuration

Any of the flags shown in `lnd-tools serve --help` can be put into a simple key=value config file.

> Exceptions: for obvious reasons, the `--datadir` and `--config` flags will need to be specified in the command line if customized.

> You can optionally specify an environment variable `LND_TOOLS_DATADIR` the server will use for `--datadir`.

You can also specify `rejectchannelmessage` in the config to override `Constants.LND.ChannelRejectMessage`.

Example: lnd-tools.conf
```
key=myAuth.pub
lnddir=/home/myUser/custom/lnd/directory
lndconfig=lnd-test.conf
rejectchannelmessage=Please reach out to lightning@mydomain.com to open a channel.
```



## Build

To build the binaries *for production*, simply run

> Note: this will remove your node_modules and reinstall them without dev dependencies. 

```
npm run build
```

You can also build them *without* removing your node_modules by running `npm run build:dev`. It is highly recommended that you always run `npm run build` when using the binaries in a production environment. The purpose of `npm run build:dev` is just so you don't mess up your dependencies

## Testing

To run tests:
```
npm run test
```

> If you encounter an error saying a package is missing, run `npm run clean:dev` and try again.


## Examples

