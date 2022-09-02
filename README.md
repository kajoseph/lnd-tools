# LND-Tools: A proxy tool for LND

## Requirements

* Node.JS v16

## Usage

For these instructions, I will use the dev command (i.e. `lnd-tools.js`), but if using a
binary, you should replace `lnd-tools` with your appropriate binary file.

First, you'll need to create an authentication private/public key pair.
```
./lnd-tools.js keygen
```

This will output a private and public key pair. 
> You can specify `--out` to write the key to files instead of STDOUT

The private key will be used from an external service to sign requests to `lnd-tools`.

Start the server with
```
./lnd-tools.js serve --key <publicKey>
```
> The above command uses several defaults. You may need to specify 

## Dev & Debug

To run the program locally, I would recommend using [Polar](https://lightningpolar.com) and set up a network. Choose an LND node to be "your" node and copy the credentials for it.

Execute the program by running
```
lnd-tools.js <...args>
```

## Build

To build the binaries, simply run
```
npm run build
```

