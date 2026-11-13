import 'dotenv/config';
import { buildCatalog } from './catalog/indexes.js';
import { connectDb, createMongoStore } from './db/models.js';
import { createApp } from './app.js';

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/build-my-holiday';

const catalog = buildCatalog();
console.log(`[catalog] ${catalog.raw.flights.length} flights, ${catalog.raw.hotels.length} hotels`);

const app = createApp({ catalog, store: createMongoStore() });
app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
connectDb(MONGO_URI); // no await: catalog routes work while Mongo connects (or fails)
