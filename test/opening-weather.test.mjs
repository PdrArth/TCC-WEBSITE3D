import test from "node:test";
import assert from "node:assert/strict";
import { claimOpeningWeather, openingWeatherKinds, openingWeatherKey } from "../src/lib/experience/opening-weather.mjs";

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function locks() {
  let previous = Promise.resolve();
  return { request: (_name, _options, task) => {
    const result = previous.then(task);
    previous = result.catch(() => {});
    return result;
  } };
}
test("ten simultaneous page openings claim all ten weather conditions without repeats", async () => {
  const options = { storage: storage(), locks: locks(), random: () => .38 };
  const claims = await Promise.all(Array.from({ length: 10 }, () => claimOpeningWeather(options)));
  assert.equal(new Set(claims.map(item => item.weather)).size, 10);
  assert.deepEqual(claims.map(item => item.position), [1,2,3,4,5,6,7,8,9,10]);
  assert.ok(claims.every(item => item.coordination === "locked"));
  assert.ok(!claims.some(item => item.weather === "dusk"));
});
test("multiple cycles remain complete and do not repeat at the cycle boundary", async () => {
  const options = { storage: storage(), locks: locks(), random: () => .999 };
  const claims = await Promise.all(Array.from({ length: 31 }, () => claimOpeningWeather(options)));
  for (let index=0;index<30;index+=10) assert.equal(new Set(claims.slice(index,index+10).map(item=>item.weather)).size,10);
  assert.notEqual(claims[9].weather,claims[10].weather);
  assert.notEqual(claims[19].weather,claims[20].weather);
  for (let start=0;start<=claims.length-10;start++) assert.equal(new Set(claims.slice(start,start+10).map(item=>item.weather)).size,10,"a group of ten tabs may cross a cycle boundary");
});
test("corrupt or obsolete storage recovers without offering unknown weather", async () => {
  for (const value of ["bad", "null", JSON.stringify({ version:16,order:Array(10).fill("clear"),cursor:0 }), JSON.stringify({ version:16,order:openingWeatherKinds,cursor:-1 })]) {
    const saved = storage(); saved.setItem(openingWeatherKey,value);
    const result = await claimOpeningWeather({ storage:saved,random:()=>.2 });
    assert.ok(openingWeatherKinds.includes(result.weather));
    assert.equal(result.position,1);
  }
});
test("blocked storage or unavailable locks never prevents opening the site", async () => {
  const unavailable = { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("blocked"); } };
  assert.equal((await claimOpeningWeather({ storage:unavailable })).coordination,"independent");
  const fallback = await claimOpeningWeather({ storage:storage(),locks:{ request:async()=>{throw Error("not supported");} },random:()=>.5 });
  assert.equal(fallback.coordination,"storage");
  assert.ok(openingWeatherKinds.includes(fallback.weather));
});

function controlledDatabase() {
  const opening = {};
  const writes = [];
  let transactions = 0, closed = 0;
  const transaction = {
    objectStore: () => ({
      get: () => { const request = {}; queueMicrotask(() => { request.result = undefined; request.onsuccess(); }); return request; },
      put: value => writes.push(value),
    }),
    abort: () => transaction.onabort(),
  };
  const connection = { close:()=>closed++, transaction:()=>{transactions++;return transaction;} };
  return { opening, transaction, writes, connection, database:{ open:()=>opening }, stats:()=>({closed,transactions}) };
}
test("database reservation resolves only after transaction commit", async () => {
  const db = controlledDatabase();
  let resolved = false;
  const result = claimOpeningWeather({database:db.database,random:()=>.3}).then(value=>{resolved=true;return value;});
  db.opening.result=db.connection;db.opening.onsuccess();
  await new Promise(setImmediate);
  assert.equal(db.writes.length,1);
  assert.equal(resolved,false,"a successful put is not yet a committed reservation");
  db.transaction.oncomplete();
  const value=await result;
  assert.equal(value.coordination,"transaction");assert.equal(value.position,1);
  assert.equal(db.stats().closed,1);
});
test("aborted reservation falls back only after abort, and late complete cannot resolve twice", async () => {
  const db=controlledDatabase();
  const saved=storage();
  const result=claimOpeningWeather({database:db.database,storage:saved,random:()=>.2});
  db.opening.result=db.connection;db.opening.onsuccess();
  await new Promise(setImmediate);
  db.transaction.onabort();
  const value=await result;assert.equal(value.coordination,"storage");
  db.transaction.oncomplete();
  assert.equal(db.stats().closed,1);assert.equal(JSON.parse(saved.getItem(openingWeatherKey)).cursor,1);
});
test("blocked database rejects opening and closes a late connection without a transaction", async () => {
  const db=controlledDatabase();
  const result=claimOpeningWeather({database:db.database,storage:storage()});
  db.opening.onblocked();
  assert.equal((await result).coordination,"storage");
  db.opening.result=db.connection;db.opening.onsuccess();
  assert.deepEqual(db.stats(),{closed:1,transactions:0});
});
test("a synchronous database denial preserves the storage fallback", async () => {
  const value=await claimOpeningWeather({database:{open:()=>{throw Error("denied");}},storage:storage()});
  assert.equal(value.coordination,"storage");
});
