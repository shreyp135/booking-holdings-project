// Our own persistent state in MongoDB. Catalog data is NOT stored here.
// Everything the app needs from the database goes through the "store" object at the bottom,
// so the routes never touch Mongoose directly (and tests can swap in an in-memory store).
import mongoose from 'mongoose';

// A built package. Saved every time it is planned or edited, so a refresh or restart keeps it.
const PackageSchema = new mongoose.Schema(
  {
    trip_id: { type: String, unique: true, index: true },
    request: Object,
    trip: Object,
    status: { type: String, default: 'PLANNED' }, // PLANNED | BOOKED
    reference: { type: String, default: null },    // set after confirm
    meta: Object,                                  // labels (Cheapest, Fastest...), travel minutes, average stars
  },
  { timestamps: true }
);

// A confirmed reservation. `reference` is the 10-digit number, kept as a string.
const ReservationSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true, index: true },
    trip: Object,
  },
  { timestamps: true }
);

export const PackageModel = mongoose.models.Package || mongoose.model('Package', PackageSchema);
export const ReservationModel =
  mongoose.models.Reservation || mongoose.model('Reservation', ReservationSchema);

export async function connectDb(uri) {
  mongoose.set('bufferTimeoutMS', 3000); // fail fast if the database is down, instead of hanging
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('[db] connected to MongoDB');
    return true;
  } catch (e) {
    console.warn(`[db] MongoDB not reachable (${e.message}). Catalog routes work; saving will fail.`);
    return false;
  }
}

const clean = (doc) => {
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  return rest;
};

export function createMongoStore() {
  return {
    async savePackage(pkg) {
      await PackageModel.findOneAndUpdate({ trip_id: pkg.trip_id }, pkg, { upsert: true });
    },
    async getPackage(tripId) {
      return clean(await PackageModel.findOne({ trip_id: tripId }).lean());
    },
    // true if saved, false if that reference already exists (the unique index decides)
    async tryCreateReservation(reference, trip) {
      try {
        await ReservationModel.create({ reference, trip });
        return true;
      } catch (e) {
        if (e.code === 11000) return false;
        throw e;
      }
    },
    async getReservation(reference) {
      return clean(await ReservationModel.findOne({ reference }).lean());
    },
  };
}
