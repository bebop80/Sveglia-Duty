const CLIENT_ID = "INSERISCI_QUI_IL_TUO_CLIENT_ID";
const API_KEY = "INSERISCI_QUI_LA_TUA_API_KEY";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let currentAlarmTime = "";
let currentResults = null;
let calendarEvents = [];

const dutyTimeEl = document.getElementById("dutyTime");
const prepBeforeDutyEl = document.getElementById("prepBeforeDuty");
const travelMinutesEl = document.getElementById("travelMinutes");
const alarmAdvanceEl = document.getElementById("alarmAdvance");
const calendarFilterEl = document.getElementById("calendarFilter");

const resultsBox = document.getElementById("results");
const presentazioneOut = document.getElementById("presentazioneOut");
const uscitaOut = document.getElementById("uscitaOut");
const svegliaOut = document.getElementById("svegliaOut");

const calcBtn = document.getElementById("calcBtn");
const copyAlarmBtn = document.getElementById("copyAlarmBtn");
const androidAlarmBtn = document.getElementById("androidAlarmBtn");

const authorizeButton = document.getElementById("authorize_button");
const signoutButton = document.getElementById("signout_button");
const calendarStatus = document.getElementById("calendarStatus");
const eventsContainer = document.getElementById("events");

function pad(n) {
  return String(n).padStart(2, "0");
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes) {
  let mins = totalMinutes % (24 * 60);
  if (mins < 0) mins += 24 * 60;
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${pad(hh)}:${pad(mm)}`;
}

function calculateTimes() {
  const dutyTime = dutyTimeEl.value;
  const prepBeforeDuty = Number(prepBeforeDutyEl.value || 0);
  const travelMinutes = Number(travelMinutesEl.value || 0);
  const alarmAdvance = Number(alarmAdvanceEl.value || 0);

  if (!dutyTime) {
    alert("Inserisci l'orario di inizio duty.");
    return;
  }

  const dutyMinutes = timeToMinutes(dutyTime);
  const presentationMinutes = dutyMinutes - prepBeforeDuty;
  const leaveHomeMinutes = presentationMinutes - travelMinutes;
  const alarmMinutes = leaveHomeMinutes - alarmAdvance;

  const result = {
    duty: minutesToTime(dutyMinutes),
    presentation: minutesToTime(presentationMinutes),
    leaveHome: minutesToTime(leaveHomeMinutes),
    alarm: minutesToTime(alarmMinutes)
  };

  currentAlarmTime = result.alarm;
  currentResults = result;

  presentazioneOut.textContent = result.presentation;
  uscitaOut.textContent = result.leaveHome;
  svegliaOut.textContent = result.alarm;
  resultsBox.style.display = "block";
  copyAlarmBtn.style.display = "block";
  androidAlarmBtn.style.display = "block";

  try {
    localStorage.setItem("svegliaDutySettings", JSON.stringify({
      dutyTime,
      prepBeforeDuty,
      travelMinutes,
      alarmAdvance
    }));
  } catch (e) {}
}

function copyAlarmTime() {
  if (!currentAlarmTime) {
    alert("Calcola prima gli orari.");
    return;
  }

  navigator.clipboard.writeText(currentAlarmTime)
    .then(() => alert(`Orario sveglia copiato: ${currentAlarmTime}`))
    .catch(() => alert(`Non sono riuscito a copiare automaticamente. Orario: ${currentAlarmTime}`));
}

function openAndroidAlarm() {
  if (!currentAlarmTime) {
    alert("Calcola prima gli orari.");
    return;
  }

  const [hh, mm] = currentAlarmTime.split(":").map(Number);

  const intentUrl = `intent://setalarm#Intent;action=android.intent.action.SET_ALARM;S.android.intent.extra.alarm.MESSAGE=Duty;S.android.intent.extra.alarm.HOUR=${hh};S.android.intent.extra.alarm.MINUTES=${mm};end`;

  try {
    window.location.href = intentUrl;
    setTimeout(() => {
      alert(`Se non si è aperta l'app Orologio, imposta manualmente la sveglia alle ${currentAlarmTime}.`);
    }, 900);
  } catch (e) {
    alert(`Imposta manualmente la sveglia alle ${currentAlarmTime}.`);
  }
}

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem("svegliaDutySettings");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.dutyTime) dutyTimeEl.value = data.dutyTime;
    if (typeof data.prepBeforeDuty !== "undefined") prepBeforeDutyEl.value = data.prepBeforeDuty;
    if (typeof data.travelMinutes !== "undefined") travelMinutesEl.value = data.travelMinutes;
    if (typeof data.alarmAdvance !== "undefined") alarmAdvanceEl.value = data.alarmAdvance;
  } catch (e) {}
}

function eventStartToTime(event) {
  const start = event.start?.dateTime || event.start?.date;
  if (!start) return null;

  if (event.start?.dateTime) {
    const dt = new Date(event.start.dateTime);
    return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }

  return null;
}

function formatEventDate(event) {
  const start = event.start?.dateTime || event.start?.date;
  if (!start) return "Data non disponibile";

  if (event.start?.dateTime) {
    const dt = new Date(event.start.dateTime);
    return dt.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return new Date(event.start.date).toLocaleDateString("it-IT");
}

function renderEvents() {
  const filter = calendarFilterEl.value.trim().toLowerCase();
  let filtered = [...calendarEvents];

  if (filter === "duty") {
    filtered = filtered.filter(ev => (ev.summary || "").toLowerCase().includes("duty"));
  }

  if (!filtered.length) {
    eventsContainer.innerHTML = `<div class="muted">Nessun evento disponibile.</div>`;
    return;
  }

  eventsContainer.innerHTML = filtered.map((event, index) => {
    const eventTime = eventStartToTime(event);
    const useButton = eventTime
      ? `<button data-event-index="${index}" class="use-event-btn secondary">Usa questo orario</button>`
      : `<div class="muted small">Evento senza orario specifico utilizzabile.</div>`;

    return `
      <div class="event-item">
        <div class="event-title">${escapeHtml(event.summary || "Evento senza titolo")}</div>
        <div class="event-meta">${escapeHtml(formatEventDate(event))}</div>
        ${useButton}
      </div>
    `;
  }).join("");

  document.querySelectorAll(".use-event-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const event = filtered[Number(btn.dataset.eventIndex)];
      const time = eventStartToTime(event);
      if (!time) {
        alert("Questo evento non contiene un orario preciso.");
        return;
      }
      dutyTimeEl.value = time;
      calculateTimes();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function gapiLoaded() {
  gapi.load("client", initializeGapiClient);
}

async function initializeGapiClient() {
  if (!API_KEY || API_KEY.includes("INSERISCI_QUI")) {
    calendarStatus.textContent = "Google Calendar non configurato: inserisci API Key e Client ID in app.js.";
    return;
  }

  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC]
  });

  gapiInited = true;
  maybeEnableButtons();
}

function gisLoaded() {
  if (!CLIENT_ID || CLIENT_ID.includes("INSERISCI_QUI")) {
    calendarStatus.textContent = "Google Calendar non configurato: inserisci API Key e Client ID in app.js.";
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: ""
  });

  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    authorizeButton.style.display = "block";
    calendarStatus.textContent = "Pronto per collegare Google Calendar.";
  }
}

function handleAuthClick() {
  if (!tokenClient) {
    alert("Google Calendar non è ancora configurato in app.js.");
    return;
  }

  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      alert("Errore autenticazione Google Calendar.");
      return;
    }

    signoutButton.style.display = "block";
    authorizeButton.textContent = "Aggiorna eventi";
    calendarStatus.textContent = "Google Calendar collegato.";
    await listUpcomingEvents();
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
    calendarEvents = [];
    renderEvents();
    calendarStatus.textContent = "Disconnesso da Google Calendar.";
    authorizeButton.textContent = "Collega Google Calendar";
    signoutButton.style.display = "none";
  }
}

async function listUpcomingEvents() {
  calendarStatus.textContent = "Caricamento eventi...";

  try {
    const response = await gapi.client.calendar.events.list({
      calendarId: "primary",
      timeMin: (new Date()).toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 20,
      orderBy: "startTime"
    });

    calendarEvents = response.result.items || [];
    renderEvents();

    if (!calendarEvents.length) {
      calendarStatus.textContent = "Nessun evento trovato nel calendario.";
      return;
    }

    calendarStatus.textContent = `${calendarEvents.length} eventi caricati dal calendario.`;
  } catch (err) {
    calendarStatus.textContent = "Errore nel recupero eventi.";
    console.error(err);
  }
}

calcBtn.addEventListener("click", calculateTimes);
copyAlarmBtn.addEventListener("click", copyAlarmTime);
androidAlarmBtn.addEventListener("click", openAndroidAlarm);
authorizeButton.addEventListener("click", handleAuthClick);
signoutButton.addEventListener("click", handleSignoutClick);
calendarFilterEl.addEventListener("change", renderEvents);

window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;

window.addEventListener("load", () => {
  loadSavedSettings();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(err => {
      console.error("SW registration failed", err);
    });
  }
});

window.addEventListener("load", () => {
  const gapiScript = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
  const gisScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');

  if (gapiScript) {
    gapiScript.addEventListener("load", gapiLoaded);
  }

  if (gisScript) {
    gisScript.addEventListener("load", gisLoaded);
  }
});
