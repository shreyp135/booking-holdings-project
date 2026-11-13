// Chooses WHICH cities to visit, in WHAT order, and for HOW MANY nights each.
// A plan is [{ city, nights }, ...]. Rules (handout section 4):
//  - every city has at least `minPerCity` nights, each city appears once
//  - the nights add up to the trip length
//  - each pair of neighbouring cities must have a transfer link in destinations.json
export function enumerateCityPlans(country, nights, minPerCity) {
  const names = country.cities.map((c) => c.name);
  const linked = new Set(country.links.map((l) => `${l.from_city}>${l.to_city}`));
  const maxCities = Math.floor(nights / minPerCity);
  const plans = [];

  // all ways to split `n` nights over `parts` cities, each part >= min
  const splits = (n, parts) => {
    if (parts === 1) return n >= minPerCity ? [[n]] : [];
    const out = [];
    for (let first = minPerCity; first <= n - (parts - 1) * minPerCity; first++)
      for (const rest of splits(n - first, parts - 1)) out.push([first, ...rest]);
    return out;
  };

  const walk = (seq) => {
    if (seq.length > 0)
      for (const split of splits(nights, seq.length)) plans.push(seq.map((city, i) => ({ city, nights: split[i] })));
    if (seq.length === maxCities) return;
    for (const c of names) {
      if (seq.includes(c)) continue;
      if (seq.length && !linked.has(`${seq[seq.length - 1]}>${c}`)) continue;
      walk([...seq, c]);
    }
  };
  walk([]);
  return plans;
}
