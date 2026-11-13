# Vaya: Build My Holiday

An application that builds a complete holiday package for a country trip. The traveler gives a departure city, a country, dates, travelers and a budget. The app returns up to three packages (flights, hotels, airport and city transfers, attractions, a day-by-day plan) that follow every travel rule, lets the traveler change anything, and books it with a 10-digit reservation number.

Built for the hackathon problem "Holiday Package: Build My Holiday".

## Technologies

| Part | Used |
|---|---|
| Frontend | React, Tailwind CSS, JavaScript |
| Backend | Node.js, Express |
| Database | MongoDB with Mongoose (saved packages and reservations only) |
| Data | JSON catalog files in `data/catalog` (flights, hotels, rooms, availability, transfers, attractions) and photos in `data/images` |
| Tests | Node's built-in test runner (`node --test`) |

## Setup (run it locally)

You need Node.js 18 or newer, and a MongoDB database (a free MongoDB Atlas cluster works).

```bash
# 1. install everything (root, server and client)
npm run setup

# 2. create the server settings
#    make a .env file and put your MongoDB connection string in MONGO_URI, and the preferred port(default:4000) for localhost.

# 3. start the API and the website (port 5173)
npm run dev
```
in both client and server directories.

Open http://localhost:5173.

### Commands

| Command | What it does |
|---|---|
| `npm run install` | Installs dependencies for root, `server` and `client`, run in their respective directories |
| `npm test` | Runs the backend tests (planner, validator, request checks, API end to end) |
| `npm run dev --prefix server` | API only, restarts on changes |
| `npm run dev --prefix client` | Website only |
| `npm run build --prefix client` | Production build of the website |

## Project structure

```
data/
  catalog/            read-only JSON data (flights, hotels, rooms, availability, transfers, attractions, ...)
  images/             attraction and hotel photos, with ATTRIBUTIONS.md (photo credits)
server/src/
  index.js            starts the API, connects to MongoDB
  app.js              Express app (also serves photos at /api/images)
  routes/api.js       all HTTP endpoints
  catalog/            loads the JSON files once and indexes them in memory
  db/                 MongoDB models and store, plus an in-memory store used by tests
  engine/
    request.js        checks the traveler's form
    cityplans.js      which cities, in what order, how many nights each
    planner.js        builds the three packages (cheapest, fastest, best rated)
    assemble.js       turns a selection of flights, hotels and so on into a full trip
    schedule.js       places attractions in free time slots
    validator.js      checks a trip against every travel rule (the source of truth)
    pricing.js        price formulas and room-fit rule
    editor.js         applies a change, re-checks everything, fixes or warns about side effects
    builder.js        "build your own trip" starting point
    booking.js        10-digit reservation numbers
client/src/
  App.jsx             pages and navigation
  api.js              all calls to the backend
  components/         landing form, package options, package page, day editor, build-your-own page, etc.
```

## City rule

- A trip is 3 to 10 nights. The first night is on or after 1 April 2027 and the return flight is on or before 20 April 2027.
- All cities are in the chosen country, each city appears once in the plan, and each stay is at least 2 nights in a row.
- Neighbouring cities must have a transfer link in the data, and each city change has exactly one transfer on that day.
- The planner picks the cities, their order and the nights in each. Offered packages prefer two or more cities. A one-city package is offered only when the trip is too short for two cities (3 nights) or when it is the only kind that fits the budget.
- The "build your own trip" city list hides one-city plans whenever two or more cities are possible.

All other rules (flights, transfers, hotels and room fit, attractions, prices) are enforced in `server/src/engine/validator.js`. A package is shown only if it passes.

## What is finished

- Landing page with validation: departure city, country, start date (defaults to 1 April 2027), nights, travelers and rooms in one dropdown (adults, children with ages, number of rooms), budget. "Find my booking" by reservation number.
- Up to three packages: Cheapest, Fastest and Best rated, shown as a card carousel with photos.
- Package page: day-by-day plan with photos, price summary that stays on screen, download of the trip as JSON.
- Edit any day: change flights, the hotel, attractions or the cities. Each option shows its price difference, and the whole package is re-checked after every change.
- After a change the app fixes or warns about what it affects: attractions that no longer fit are moved or removed with a note, and a late arrival warns about hotel check-in time.
- Over-budget requests show the cheapest possible price and what to change. An over-budget trip cannot be booked.
- Confirm a booking to get a 10-digit reservation number. It is saved, and "Find my booking" reopens it, also after a server restart.
- Build your own trip: tabs for cities, flights, hotels and attractions with a fixed budget box, then straight to review.
- Photos from the data set with a "Photo credits" list.

## Known limitations

- Booking does not use up seats or rooms: availability comes from the read-only data, so two bookings can take the same last room.
- There is no "quick request" (plain-sentence input) and no user accounts without the use of AI in our app.
- The code that moves or removes clashing attractions after a change has no dedicated test yet.
- Concurrent bookings are not handled.
