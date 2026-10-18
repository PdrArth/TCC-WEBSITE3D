import { weatherKinds } from "./weather.mjs";

// Dusk is a time of day, not an eleventh weather condition.
export const openingWeatherKinds = weatherKinds.filter(kind => kind !== "dusk");
export const openingWeatherKey = "tcc-opening-weather-v16";

const draw = random => Math.max(0, Math.min(.999999, Number(random()) || 0));
function shuffled(random) {
  const order = [...openingWeatherKinds];
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.floor(draw(random) * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  return order;
}
function validState(value) {
  return value?.version === 16 && Array.isArray(value.order) && value.order.length === openingWeatherKinds.length
    && new Set(value.order).size === openingWeatherKinds.length && value.order.every(kind => openingWeatherKinds.includes(kind))
    && Number.isInteger(value.cursor) && value.cursor >= 0 && value.cursor <= value.order.length;
}

function reserveState(value, random) {
  const state = validState(value) ? value : { version:16, order:shuffled(random), cursor:0 };
  if (state.cursor === state.order.length) state.cursor = 0;
  const weather = state.order[state.cursor++];
  return { state, weather, position:state.cursor };
}

/** IDB read/write transactions serialize the read and commit across documents. */
function claimTransaction(database, random) {
  return new Promise((resolve, reject) => {
    let settled = false, connection;
    const opening = database.open(openingWeatherKey, 1);
    const fail = () => {
      if (settled) return;
      settled = true; clearTimeout(timer); connection?.close(); reject(new Error("Weather reservation unavailable"));
    };
    // Only the database opening has a deadline. A transaction must finish or abort
    // before a fallback can reserve, so a late commit never consumes two positions.
    const timer = setTimeout(fail, 5000);
    opening.onblocked = fail;
    opening.onerror = fail;
    opening.onupgradeneeded = () => {
      if (settled) { opening.transaction?.abort(); return; }
      if (!opening.result.objectStoreNames.contains("weather")) opening.result.createObjectStore("weather");
    };
    opening.onsuccess = () => {
      connection = opening.result;
      if (settled) { connection.close(); return; }
      clearTimeout(timer);
      connection.onversionchange = () => connection.close();
      try {
        const transaction = connection.transaction("weather", "readwrite");
        const store = transaction.objectStore("weather");
        let reservation;
        transaction.onabort = fail;
        transaction.onerror = () => { /* Abort confirms that no position committed. */ };
        transaction.oncomplete = () => {
          if (settled) return;
          settled = true; connection.close(); resolve({ weather:reservation.weather, position:reservation.position, coordination:"transaction" });
        };
        const read = store.get("cycle");
        read.onsuccess = () => {
          try {
            reservation = reserveState(read.result, random);
            store.put(reservation.state, "cycle");
          } catch { transaction.abort(); }
        };
      } catch { fail(); }
    };
  });
}

/** One weather per page load. Storage/locks are a best-effort fallback only. */
export async function claimOpeningWeather({ database, storage, locks, random = Math.random } = {}) {
  if (database?.open) {
    try { return await claimTransaction(database, random); } catch { /* Optional browser storage. */ }
  }
  const claim = coordination => {
    try {
      if (!storage) throw new Error("Storage unavailable");
      let state;
      try { state = JSON.parse(storage.getItem(openingWeatherKey)); } catch { /* Rebuild corrupt state. */ }
      const reservation = reserveState(state, random);
      storage.setItem(openingWeatherKey, JSON.stringify(reservation.state));
      return { weather:reservation.weather, coordination, position:reservation.position };
    } catch {
      // Private/storage-disabled contexts remain usable, without a cross-tab guarantee.
      return { weather: openingWeatherKinds[Math.floor(draw(random) * openingWeatherKinds.length)], coordination: "independent", position: null };
    }
  };
  if (locks?.request) {
    try { return await locks.request(openingWeatherKey, { mode: "exclusive" }, () => claim("locked")); }
    catch { /* Some embedded browsers reject Web Locks; storage remains optional. */ }
  }
  return claim("storage");
}
