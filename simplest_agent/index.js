const storage = new require('jolocom-sdk-storage-inmemory').JolocomInmemoryStorage()
const sdk = new require('jolocom-sdk').JolocomSDK({ storage })

// Running init with no arguments will:
// - create an identity if it doesn't exist
// - load the identity from storage
sdk.init().then(identityWallet => {
  console.log('Agent identity', identityWallet.identity)
})
