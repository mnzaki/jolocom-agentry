## Websockets agent
Run the first agent:
```
node ws_agent1/index.js -l 6789
```

Then the other agent
```
node ws_agent2/index.js localhost:6789
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

