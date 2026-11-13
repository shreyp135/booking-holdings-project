// Photos from the data set (images/ folder) for the items of a trip.
// Attraction photos show the real place; hotel photos are generic room photos shared by hotel type.
export function mediaFor(trip, catalog) {
  const photos = {}; // catalog_id -> 'images/...'
  const attractions = [];
  const hotels = [];
  for (const it of trip.items) {
    if (it.type === 'attraction') {
      const img = catalog.attractionById.get(it.catalog_id)?.image;
      if (img) { photos[it.catalog_id] = img; attractions.push(img); }
    } else if (it.type === 'hotel') {
      const img = catalog.hotelById.get(it.catalog_id)?.image;
      if (img) { photos[it.catalog_id] = img; hotels.push(img); }
    }
  }
  // gallery: best picture first (real places before room photos), no duplicates
  return { photos, gallery: [...new Set([...attractions, ...hotels])] };
}
