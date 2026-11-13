// Our own persistent state. Catalog data is NOT stored here.
import mongoose from 'mongoose';

// A built (not yet confirmed) package. Stored so a refresh keeps it.
const PackageSchema = new mongoose.Schema(
  {
    trip_id: { type: String, unique: true, index: true },
    request: Object,   // the traveler's form input
    trip: Object,      // the package in the shared trip format
    status: { type: String, default: 'PLANNED' },
  },
  { timestamps: true }
);

// A confirmed reservation. `reference` is the 10-digit number (string).
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
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log('[db] connected to MongoDB');
    return true;
  } catch (e) {
    console.warn(`[db] MongoDB not reachable (${e.message}). Catalog routes work; saving will fail.`);
    return false;
  }
}
