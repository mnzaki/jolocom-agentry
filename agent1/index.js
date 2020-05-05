const { JolocomSDK, initStore } = require('jolocom-sdk')
const { generateSecureRandomBytes } = require('jolocom-sdk/js/src/lib/util')
// FIXME: KeyChain should use a good default path
// FIXME: KeyChain should be disabled by default?
const { KeyChain } = require('jolocom-sdk/js/src/polyfills/keychain')
KeyChain.PASSWORD_LOCATION = __dirname + '/password.txt'

const store = initStore()
const sdk = new JolocomSDK(store)
const actions = require('jolocom-sdk/js/src/actions')

const initIdentity = async (store) => {
  await store.backendMiddleware.initStorage()
  console.log('storage ready')
  try {
    await store.dispatch(actions.accountActions.checkIdentityExists)
    if (store.getState().account.did.did) return
  } catch (err) {
    console.log('error from accountActions.checkIdentityExists', err)
  }
  console.log('no identity.... creating')
  try {
    await store.dispatch(
      actions.registrationActions.createIdentity(generateSecureRandomBytes(16)),
    )
  } catch (err) {
    console.log('error from registrationActions.createIdentity', err)
  }
  console.log('initIdentity recursing')
  return initIdentity(store)
}

async function start() {
  await initIdentity(store)
  const idw = store.backendMiddleware.identityWallet
  console.log("identity: ", idw.identity)
}

start()
