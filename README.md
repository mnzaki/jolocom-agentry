## Websockets agent
Run the first agent:
```
yarn run ts-node ws_agent1/index.ts -l 6789
```

Then the other agent
```
yarn run ts-node ws_agent2/index.ts localhost:6789
```


## Typeorm agent

First initialise the agent DB
```
yarn run typeorm -f typeorm_agent/ormconfig.js schema:sync
```

Then run the agent:

```
node typeorm_agent/index.js
```

