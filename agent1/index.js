const { JolocomSDK, initStore } = require('jolocom-sdk')
const { JSONWebToken } = require('jolocom-lib/js/interactionTokens/JSONWebToken')
const { generateSecureRandomBytes } = require('jolocom-sdk/js/src/lib/util')
// FIXME: KeyChain should use a good default path
// FIXME: KeyChain should be disabled by default?
const { KeyChain } = require('jolocom-sdk/js/src/polyfills/keychain')
KeyChain.PASSWORD_LOCATION = './password.txt'

const initIdentity = async () => {
  let sdk
  const store = initStore()
  try {
    sdk = await JolocomSDK.fromStore(store)
    console.log('storage ready')
  } catch (err) {
    console.log('error from JolocomSDK.fromStore', err)
    throw err
  }

  try {
    if (!store.getState().account.did.did) {
      console.log('no identity.... creating')
      await store.backendMiddleware.storageLib.connection.close()
      sdk = await JolocomSDK.newDIDFromSeed(await generateSecureRandomBytes(16))
    }
  } catch (err) {
    console.log('error from JolocomSDK.newDIDFromSeed', err)
    throw err
  }
  return sdk
}

const WebSocket = require('ws')
let hostport
async function start() {
  if (!process.argv[2]) {
    console.error(`Usage ${process.argv0} (HOST:PORT | -l [PORT])`)
    process.exit(1)
  }

  const sdk = await initIdentity()
  const password = await sdk.store.backendMiddleware.keyChainLib.getPassword()

  console.log("identity: ", sdk.idw.identity)

  if (process.argv[2] == '-l') {
    /**
     * REQUESTER
     */
    const port = parseInt(process.argv[3] || '6789')
    // we be server
    const wss = new WebSocket.Server({ port })
    console.log('listening on port', port)

    wss.on('connection', function connection(ws) {
      ws.on('message', function incoming(message) {
        console.log('received message: %s', message);
        const token = JSONWebToken.decode(message)
        console.log('decoded to token: %s', token);
      });
      getAuthToken1(sdk).then(jwt => {
        console.log('created JWT', jwt)
        ws.send(jwt)
      })
    });
  } else if (process.argv[2]) {
    /**
     * RESPONDER
     */
    hostport = process.argv[2]
    const ws = new WebSocket(`ws://${hostport}`)

    ws.on('open', function open() {
      console.log('Websocket opened to', hostport)
    });
    ws.on('message', function incoming(message) {
      console.log('received message', message)
      const token = JSONWebToken.decode(message)
      console.log('decoded to token: %s', token);
      consumeAuthToken(sdk, message).then(response => {
        ws.send(response)
      })
    })
  }
}

start()

const { SSO } = require('jolocom-lib/js/sso/sso')

function getPublicListenURL() {
  return `ws://${hostport}`
}

// for wss.on('connection')
async function getAuthToken1(sdk) {
  const pass = await sdk.store.backendMiddleware.keyChainLib.getPassword()
  // TODO SDK must do the password plumbing after first initialized
  const token = await sdk.idw.create.interactionTokens.request.auth({
    callbackURL: getPublicListenURL(),
  }, pass)
  return token.encode()
}

// for ws.onMessage() try to consume the token and begin an interaction
async function consumeAuthToken(sdk, jwt) {
  // see sdk/sso/authenticationRequest
  const token = JSONWebToken.decode(jwt)
  const { interactionManager } = sdk.store.backendMiddleware
  const interaction = await interactionManager.start(
    '', // channel,
    token
  )
  const response = await interaction.createAuthenticationResponse()
  // FIXME this doesn't work because new transport layer WS
  // interaction.send(response)

  return response.encode()
}
