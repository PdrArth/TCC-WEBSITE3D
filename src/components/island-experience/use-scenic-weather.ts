"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { advanceHour, clockLabel, frontDuration, nextFront, phaseAtHour, wrapHour } from "@/lib/experience/scenic-clock.mjs";
import { getSeason, type Season } from "@/lib/experience/seasons.mjs";
import type { Weather } from "@/lib/experience/weather.mjs";
import { claimOpeningWeather, type OpeningWeather } from "@/lib/experience/opening-weather.mjs";

let pageOpening: Promise<OpeningWeather> | undefined;
function openingForPage() {
  if (!pageOpening) {
    let storage: Storage | undefined;
    let database: IDBFactory | undefined;
    try { storage = window.localStorage; } catch { /* Optional storage. */ }
    try { database = window.indexedDB; } catch { /* Optional storage. */ }
    pageOpening = claimOpeningWeather({ database, storage, locks: window.navigator.locks });
  }
  return pageOpening;
}

export function useScenicWeather(active: boolean) {
  const [weather, setWeather] = useState<Weather>("clear");
  const [season, setSeason] = useState<Season>("spring");
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [timeOfDay, setTimeOfDay] = useState(13);
  const timeRef = useRef(13);
  const lastTick = useRef(0);
  const [opening, setOpening] = useState<OpeningWeather | null>(null);
  const weatherSelected = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const initialSeason = getSeason();
    const timer = setTimeout(() => {
      setSeason(initialSeason);
      timeRef.current = 12.5 + Math.random() * 1.5;
      setTimeOfDay(timeRef.current);
    }, 0);
    void openingForPage().then(value => {
      if (cancelled) return;
      setOpening(value);
      if (!weatherSelected.current) setWeather(value.weather);
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (!active) return;
    lastTick.current = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(2, Math.max(0, (now - lastTick.current) / 1000));
      lastTick.current = now;
      timeRef.current = advanceHour(timeRef.current, elapsed);
      setTimeOfDay(timeRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (!active || !opening || mode !== "automatic") return;
    const timer = setTimeout(() => setWeather(value => nextFront(value)), frontDuration());
    return () => clearTimeout(timer);
  }, [active, mode, weather, opening]);
  const manualWeather = useCallback((value: Weather) => {
    weatherSelected.current = true;
    setMode("manual");
    setWeather(value);
    if (value === "dusk") { timeRef.current=17.5; setTimeOfDay(17.5); }
  }, []);
  const automatic = useCallback(() => { weatherSelected.current = true; setMode("automatic"); setWeather(value => nextFront(value)); }, []);
  const setTime = useCallback((hour: number) => { timeRef.current=wrapHour(hour); setTimeOfDay(timeRef.current); }, []);
  return { weather, season, setSeason, mode, manualWeather, automatic, opening, timeOfDay, timeRef, setTime, phase: phaseAtHour(timeOfDay), clock: clockLabel(timeOfDay) };
}
