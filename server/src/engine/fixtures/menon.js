// A hand-checked, VALID Menon package (BLR -> Tokyo 3 nights -> Kyoto 3 nights).
// Used as the base for every validator test.
export const menon = {
  trip_id: "trip-menon",
  traveler: { name: "Menon family", home_airport: "BLR", adults: 2, children: 1, child_ages: [6] },
  country: "Japan",
  start_date: "2027-04-10",
  end_date: "2027-04-16",
  budget_inr: 350000,
  total_inr: 239330,
  items: [
    {"item_id": "i1", "status": "PLANNED", "room_id": null, "booking": null, "sources": [], "warnings": [], "type": "flight", "name": "NS 811 BLR to NRT", "city": "Tokyo", "catalog_id": "FL-405", "start": "2027-04-10T06:30", "end": "2027-04-10T21:30", "quantity": 3, "price_inr": 71820},
    {"item_id": "i2", "status": "PLANNED", "room_id": null, "booking": null, "sources": [], "warnings": [], "type": "flight", "name": "AV 515 KIX to BLR", "city": "Kyoto", "catalog_id": "FL-411", "start": "2027-04-16T12:00", "end": "2027-04-16T18:00", "quantity": 3, "price_inr": 78120},
    {"item_id": "i3", "status": "PLANNED", "room_id": "RM-TYO-004-B", "booking": null, "sources": [], "warnings": [], "type": "hotel", "name": "Ueno Garden Inn", "city": "Tokyo", "catalog_id": "HTL-TYO-004", "start": "2027-04-10", "end": "2027-04-13", "quantity": 1, "price_inr": 28392},
    {"item_id": "i4", "status": "PLANNED", "room_id": "RM-KYO-004-B", "booking": null, "sources": [], "warnings": [], "type": "hotel", "name": "Sakura Garden Hotel", "city": "Kyoto", "catalog_id": "HTL-KYO-004", "start": "2027-04-13", "end": "2027-04-16", "quantity": 1, "price_inr": 24360},
    {"item_id": "i5", "status": "PLANNED", "room_id": null, "booking": null, "sources": [], "warnings": [], "type": "transfer", "name": "Narita airport taxi to Ueno", "city": "Tokyo", "catalog_id": "TR-NRT-UEN-TAXI", "start": "2027-04-10T22:30", "end": null, "quantity": 1, "price_inr": 12880},
    {"item_id": "i6", "status": "PLANNED", "room_id": null, "booking": null, "sources": [], "warnings": [], "type": "transfer", "name": "Shinkansen Tokyo to Kyoto", "city": "Kyoto", "catalog_id": "TR-TYO-KYO-01", "start": "2027-04-13T09:00", "end": null, "quantity": 3, "price_inr": 19838},
    {"item_id": "i7", "status": "PLANNED", "room_id": null, "booking": null, "sources": [], "warnings": [], "type": "transfer", "name": "Kansai limousine bus to Kyoto", "city": "Kyoto", "catalog_id": "TR-KIX-KYO-BUS", "start": "2027-04-16T07:20", "end": null, "quantity": 3, "price_inr": 3920},
    {"item_id": "i8", "status": "PLANNED", "room_id": null, "booking": null, "sources": [], "warnings": [], "type": "attraction", "name": "Senso-ji", "city": "Tokyo", "catalog_id": "ATT-TYO-004", "start": "2027-04-11T07:00", "end": "2027-04-11T08:00", "quantity": 3, "price_inr": 0},
    {"item_id": "i9", "status": "PLANNED", "room_id": null, "booking": null, "sources": [], "warnings": [], "type": "attraction", "name": "Ueno Park", "city": "Tokyo", "catalog_id": "ATT-TYO-008", "start": "2027-04-12T06:00", "end": "2027-04-12T07:30", "quantity": 3, "price_inr": 0},
    {"item_id": "i10", "status": "PLANNED", "room_id": null, "booking": null, "sources": [], "warnings": [], "type": "attraction", "name": "Fushimi Inari Taisha", "city": "Kyoto", "catalog_id": "ATT-KYO-002", "start": "2027-04-14T07:00", "end": "2027-04-14T09:00", "quantity": 3, "price_inr": 0},
    {"item_id": "i11", "status": "PLANNED", "room_id": null, "booking": null, "sources": [], "warnings": [], "type": "attraction", "name": "Arashiyama Bamboo Grove", "city": "Kyoto", "catalog_id": "ATT-KYO-004", "start": "2027-04-15T08:00", "end": "2027-04-15T09:00", "quantity": 3, "price_inr": 0},
  ],
};
