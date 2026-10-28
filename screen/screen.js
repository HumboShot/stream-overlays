// Stream screen. Reads the mode from the URL query (?mode=afk), fills in the
// text from SCREEN_MODES in screen.config.js, and starts the shared overlay
// behavior from ../shared/overlay-common.js.
const requestedMode = new URLSearchParams(location.search).get('mode');
const modeName = requestedMode in SCREEN_MODES ? requestedMode : DEFAULT_SCREEN_MODE;
const { pageTitle, status, title, ...overlayOptions } = SCREEN_MODES[modeName];

document.body.dataset.mode = modeName;
document.title = pageTitle;
document.querySelector('.status').textContent = status;

const titleElement = document.querySelector('.starting-text');
titleElement.textContent = title;
titleElement.dataset.text = title;

// --- SUN AND NIGHT CYCLE ---
// The sun moves along the orbit from the real sunrise to the real sunset, and
// the moon takes the night half. The real sun altitude sets the sky light.
const RAD = Math.PI / 180;
const clamp01 = (value) => Math.min(Math.max(value, 0), 1);

// Returns the sun altitude in degrees, and the minutes since solar noon and
// the minutes from sunrise to solar noon. This uses the NOAA approximation:
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
function getSun(date, latitude, longitude) {
    const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
    const dayOfYear = (date.getTime() - yearStart) / 86400000;
    const g = 2 * Math.PI / 365 * dayOfYear;

    const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
        - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const declination = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
        - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
        - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);

    const lat = latitude * RAD;
    const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    const solarMinutes = utcMinutes + equationOfTime + 4 * longitude;
    const minutesFromNoon = ((solarMinutes - 720) % 1440 + 2160) % 1440 - 720;

    const hourAngle = minutesFromNoon / 4 * RAD;
    const altitude = Math.asin(Math.sin(lat) * Math.sin(declination)
        + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)) / RAD;

    // 90.833 degrees includes refraction and the size of the sun disc. Outside
    // -1..1 the sun does not set (midnight sun) or does not rise (polar night).
    const sunriseCos = Math.cos(90.833 * RAD) / (Math.cos(lat) * Math.cos(declination))
        - Math.tan(lat) * Math.tan(declination);
    const halfDayMinutes = Math.acos(Math.min(Math.max(sunriseCos, -1), 1)) / RAD * 4;

    return { altitude, minutesFromNoon, halfDayMinutes };
}

// Returns the moon age as a fraction of the lunar month. 0 = new moon, 0.5 = full moon.
function getMoonAge(date) {
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    const lunarMonth = 29.530588853 * 86400000;
    return (((date.getTime() - knownNewMoon) / lunarMonth) % 1 + 1) % 1;
}

// Returns the orbit angle in degrees. -90 = sunrise, 0 = noon, 90 = sunset, 180 = midnight.
function getOrbitAngle({ minutesFromNoon, halfDayMinutes }) {
    if (halfDayMinutes > 0 && Math.abs(minutesFromNoon) <= halfDayMinutes) {
        return -90 + 180 * (minutesFromNoon + halfDayMinutes) / (2 * halfDayMinutes);
    }
    const nightMinutes = 1440 - 2 * halfDayMinutes;
    const minutesSinceSunset = minutesFromNoon > 0
        ? minutesFromNoon - halfDayMinutes
        : minutesFromNoon + 1440 - halfDayMinutes;
    return 90 + 180 * minutesSinceSunset / nightMinutes;
}

// The art shows the lit side on the left. Mirror it when the right side is lit:
// a waxing moon in the northern hemisphere, or a waning moon in the southern.
function updateMoon(moonElement, age) {
    const litFraction = (1 - Math.cos(2 * Math.PI * age)) / 2;
    const phase = litFraction < 0.05 ? 'new'
        : litFraction < 0.35 ? 'crescent'
        : litFraction < 0.65 ? 'half'
        : litFraction < 0.95 ? 'gibbous'
        : 'full';
    for (const art of moonElement.querySelectorAll('pre')) {
        art.hidden = art.dataset.phase !== phase;
    }
    moonElement.classList.toggle('is-mirrored', (age < 0.5) === (SKY_LATITUDE >= 0));
}

function initSky() {
    const starField = document.querySelector('.sky-stars');
    for (let i = 0; i < SKY_STAR_COUNT; i++) {
        const star = document.createElement('div');
        star.className = 'sky-star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 90}%`;
        star.style.animationDelay = `${-Math.random() * 3}s`;
        starField.appendChild(star);
    }

    const orbit = document.querySelector('.sky-orbit');
    const sun = document.querySelector('.sky-sun');
    const moon = document.querySelector('.sky-moon');
    const dayLayer = document.querySelector('.sky-day');
    const twilightLayer = document.querySelector('.sky-twilight');
    const startTime = Date.now();

    function updateSky() {
        // In test mode, one cycle plays a full day, from the real time now.
        const elapsed = Date.now() - startTime;
        const time = SKY_CYCLE_SECONDS > 0
            ? startTime + elapsed * 86400 / SKY_CYCLE_SECONDS
            : Date.now();
        const date = new Date(time);
        const sunInfo = getSun(date, SKY_LATITUDE, SKY_LONGITUDE);
        const angle = getOrbitAngle(sunInfo);
        const altitude = sunInfo.altitude;

        orbit.style.transform = `rotate(${angle}deg)`;
        sun.style.transform = moon.style.transform = `rotate(${-angle}deg)`;

        // Full day light above 10 degrees. Twilight colors from 12 degrees above
        // to 12 degrees below the horizon. Stars come out as the sky gets dark.
        dayLayer.style.opacity = clamp01((altitude + 2) / 12);
        twilightLayer.style.opacity = altitude > 4
            ? clamp01(1 - (altitude - 4) / 8)
            : clamp01(1 - (-6 - altitude) / 6);
        starField.style.opacity = clamp01((-4 - altitude) / 8);

        updateMoon(moon, getMoonAge(date));
    }

    updateSky();
    if (SKY_CYCLE_SECONDS > 0) {
        (function animate() {
            updateSky();
            requestAnimationFrame(animate);
        })();
    } else {
        setInterval(updateSky, 1000);
    }
}

initSky();
initOverlay(overlayOptions);
