# @better-media/mongodb-adapter

MongoDB database adapter for Better Media.

## Installation

```bash
npm install @better-media/mongodb-adapter
```

## Usage

```typescript
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "@better-media/mongodb-adapter";

const client = new MongoClient("mongodb://localhost:27017");
const adapter = mongodbAdapter(client, {
  config: { databaseName: "my_db" },
  schema: mySchema,
});
```
