
import 'dotenv/config';
console.log(process.env.MONGO_URI)
import express from 'express';
import cors from 'cors';
import { buildCatalog } from './catalog/indexes.js';
import { connectDb } from './db/models.js';
import { buildRouter } from './routes/api.js';

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/build-my-holiday';


const catalog = buildCatalog();
console.log(
  `[catalog] ${catalog.raw.flights.length} flights, ${catalog.raw.hotels.length} hotels, ` +
    `${catalog.raw.rooms.length} rooms, ${catalog.raw.attractions.length} attractions`
);

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', buildRouter(catalog));

await connectDb(MONGO_URI);
app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
