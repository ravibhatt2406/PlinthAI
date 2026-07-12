import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json({ error: 'lat and lng parameters are required' }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch sunrise-sunset API
    let sunTimes = null;
    try {
      const sunUrl = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${todayStr}&formatted=0`;
      const res = await fetch(sunUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK') {
          sunTimes = data.results;
        }
      }
    } catch (err) {
      console.error('Failed to fetch from sunrise-sunset.org:', err);
    }

    // Fetch weather seasonal daily from Open-Meteo
    let weatherData = null;
    try {
      const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const res = await fetch(meteoUrl);
      if (res.ok) {
        weatherData = await res.json();
      }
    } catch (err) {
      console.error('Failed to fetch from open-meteo:', err);
    }

    return NextResponse.json({
      sunTimes,
      weather: weatherData?.daily || null
    });
  } catch (error) {
    const err = error as Error;
    console.error('sun-weather aggregator route error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
