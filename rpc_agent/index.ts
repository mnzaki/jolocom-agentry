const { JSONWebToken } = require('jolocom-lib/js/interactionTokens/JSONWebToken')
const typeorm = require('typeorm')
const { JolocomTypeormStorage } = require('@jolocom/sdk-storage-typeorm')
const { JolocomSDK, FilePasswordStore } = require('@jolocom/sdk')
const WebSocket = require('ws')
let hostport

const typeormConfig = {
  type: 'sqlite',
  database: __dirname + '/db.sqlite3',
  logging: ['error', 'warn', 'schema'],
  entities: [ ...require('@jolocom/sdk-storage-typeorm').entityList ],
  migrations: [__dirname + '/migrations/*.ts'],
  migrationsRun: true,
  synchronize: true,
  cli: {
    migrationsDir: __dirname + '/migrations',
  },
}

async function start() {
  if (!process.argv[2]) {
    console.error(`Usage ${process.argv0} localhost:9000/{nonce}`)
    process.exit(1)
  }

  const typeormConnection = await typeorm.createConnection(typeormConfig)
  const storage = new JolocomTypeormStorage(typeormConnection)
  const passwordStore = new FilePasswordStore(__dirname+'/password.txt')

  console.log('about to create SDK instance')
  const sdk = new JolocomSDK({ storage, passwordStore })

  // Running init with no arguments will:
  // - create an identity if it doesn't exist
  // - load the identity from storage
  const identityWallet = await sdk.init()
  console.log('Agent identity', identityWallet.identity)

  /**
   * RESPONDER
   */
  hostport = process.argv[2]
  const ws = new WebSocket(`ws://${hostport}`)

  let ready = false
  ws.on('open', function open() {
    console.log('Websocket opened to', hostport)
  });
  ws.on('message', function incoming(message) {
    console.log('received message', message)
    const token = JSONWebToken.decode(message)
    console.log('decoded to token: %s', token);
    if (!ready) {
      consumeAuthToken(sdk, message).then(response => {
        ws.send(response)
      })
      ready = true
      console.log('READY!')
    } else {
      console.log('consuming RPC')
      consumeRPCToken(sdk, message).then(result => {
        ws.send(result)
        console.log('sent result', result)
      })
    }
  })
}

start()

const { SSO } = require('jolocom-lib/js/sso/sso')

function getPublicListenURL() {
  return `ws://${hostport}`
}

// for wss.on('connection')
async function getAuthToken1(sdk) {
  const pass = await sdk.bemw.keyChainLib.getPassword()
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
  const { interactionManager } = sdk.bemw
  const interaction = await interactionManager.start(
    '', // channel,
    token
  )
  const response = await interaction.createAuthenticationResponse()
  // FIXME this doesn't work because new transport layer WS
  // interaction.send(response)

  return response.encode()
}
// for ws.onMessage() try to consume the token and begin an interaction
async function consumeRPCToken(sdk, jwt) {
  // see sdk/sso/authenticationRequest
  const token = JSONWebToken.decode(jwt)
  sdk.tokenRecieved(jwt)
  const { interactionManager } = sdk.bemw
  const interaction = interactionManager.getInteraction(token.nonce)
  const response = await interaction.createDecResponseToken()
  const res = Buffer.from(response.body.result, 'base64').toString()

  return res
}
