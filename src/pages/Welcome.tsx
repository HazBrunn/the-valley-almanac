import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../state/store';
import { DatePicker, WeatherPicker } from '../ui/DayControls';
import { formatDate, type GameDate } from '../engine/calendar';
import type { Weather } from '../engine/weather';
import { fixedWeatherFor } from '../engine/weather';
import { festivals } from '../data';

export default function Welcome() {
  const { profile, update } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [farmName, setFarmName] = useState(profile.farmName === 'My Farm' ? '' : profile.farmName);
  const [date, setDate] = useState<GameDate>(profile.day.date);
  const fest = (d: GameDate) => festivals.some((f) => f.kind === 'main' && f.season === d.season && d.day >= f.startDay && d.day <= f.endDay);
  const [weather, setWeather] = useState<Weather>(profile.day.weather);

  const finish = () => {
    update((p) => ({
      ...p,
      onboarded: true,
      farmName: farmName.trim().slice(0, 60) || p.farmName,
      day: { ...p.day, date, weather },
    }));
    navigate('/', { replace: true });
  };

  return (
    <div className="stack" style={{ marginTop: 16, maxWidth: 620, marginInline: 'auto' }}>
      {step === 0 && (
        <section className="card stack" aria-labelledby="w0">
          <h2 id="w0" style={{ fontSize: '1.6rem' }}>
            Welcome to The Valley Almanac 🌱
          </h2>
          <p>Tell the Almanac what day it is on your farm, and it will tell you who’s where, which fish are biting and what’s special today.</p>
          <p className="small muted">Everything stays on this device. No account, no internet needed once it’s loaded.</p>
          <p style={{ fontFamily: 'var(--font-head)' }}>Made for Esha. 🌸</p>
          <button type="button" className="btn primary big" onClick={() => setStep(1)}>
            Let’s begin
          </button>
        </section>
      )}
      {step === 1 && (
        <section className="card stack" aria-labelledby="w1">
          <h2 id="w1">What day is it in your game?</h2>
          <DatePicker
            value={date}
            onChange={(d) => {
              setDate(d);
              const f = fixedWeatherFor(d, fest(d));
              setWeather(f ? f.weather : 'unknown');
            }}
          />
          <p>
            <strong>{formatDate(date, { weekday: true })}</strong>
          </p>
          <h3>And the weather?</h3>
          <WeatherPicker value={weather} season={date.season} onChange={setWeather} label="Weather today" />
          <div className="row-wrap">
            <button type="button" className="btn primary" onClick={() => setStep(2)}>
              Next
            </button>
            <button type="button" className="btn ghost" onClick={() => setStep(0)}>
              Back
            </button>
          </div>
        </section>
      )}
      {step === 2 && (
        <section className="card stack" aria-labelledby="w2">
          <h2 id="w2">Name your farm (optional)</h2>
          <input className="input" value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="e.g. Moonlight Farm" maxLength={60} aria-label="Farm name" />
          <p className="small muted">
            Later you can add friendships, unlocks and your collections in Settings and the Journal — or import them from a PC save file. All of it is optional; when something isn’t known the Almanac shows the possibilities instead of guessing.
          </p>
          <div className="row-wrap">
            <button type="button" className="btn primary big" onClick={finish}>
              Open my almanac
            </button>
            <button type="button" className="btn ghost" onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        </section>
      )}
      {step > 0 && (
        <button type="button" className="btn ghost small" onClick={finish}>
          Skip setup
        </button>
      )}
    </div>
  );
}
