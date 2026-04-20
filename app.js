const CLIENT_ID = "INSERISCI_QUI_IL_TUO_CLIENT_ID";
const API_KEY = "INSERISCI_QUI_LA_TUA_API_KEY";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let currentAlarmTime = "";
let calendarEvents = [];

const dutyTimeEl = document.getElementById("dutyTime");
const prepBeforeDutyEl = document.getElementById("prepBeforeDuty");
const travelMinutesEl = document.getElementById("travelMinutes");
const alarmAdvanceEl = document.getElementById("alarmAdvance");

const calcBtn = document.getElementById("calcBtn");
const resultsEl = document.getElementById("results");
const presentazioneOut = document.getElementById("presentazioneOut");
const uscitaOut = document.getElementById("uscitaOut");
const svegliaOut = document.getElementById("svegliaOut");
const copyAlarmBtn = document.getElementById("copyAlarmBtn");
const androidAlarmBtn = document.getElementById("androidAlarmBtn");

const authorizeButton = document.getElementById("authorize_button");
const signoutButton = document.getElementById("signout_button");
const calendarStatus = document.getElementById("calendarStatus");
const eventsEl = document.getElementById("events");

function pad(n) {
  return String(n).padStart(2, "0");
}

function timeToMinutes(str) {
  const [h, m] = str.split(":").map(Number);
  return (h * 60) + m;
}

function minutesToTime(total) {
  let mins = total % (24 * 60);
  if (mins < 0) mins += (24 * 60);
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

function calculateTimes() {
  const dutyTime = dutyTimeEl.value;
  const prepBeforeDuty = Number(prepBeforeDutyEl.value || 0);
  const travelMinutes = Number(travelMinutesEl.value || 0);
  const alarmAdvance = Number(alarmAdvanceEl.value || 0);

  if (!dutyTime) {
    alert("Inserisci un orario duty.");
    return;
  }

  const dutyMinutes = timeToMinutes(dutyTime);
  const presentation = dutyMinutes - prepBeforeDuty;
  const leaveHome = presentation - travelMinutes;
  const alarm = leaveHome - alarmAdvance;

  const presentationText = minutesToTime(presentation);
  const leaveHomeText = minutesToTime(leaveHome);
  const alarmText = minutesToTime(alarm);

  presentazioneOut.textContent = presentationText;
  uscitaOut.textContent = leaveHomeText;
  svegliaOut.textContent = alarmText;
  resultsEl.style.display = "block";
  currentAlarmTime = alarmText;
  copyAlarmBtn.style.display = "block";
  androidAlarmBtn.style.display = "block";
}

function copyAlarmTime() {
  if (!currentAlarmTime) {
    alert("Calcola prima gli orari.");
    return;
  }

  navigator.clipboard.writeText(currentAlarmTime)
    .then(() => alert(`Orario sveglia copiato: ${currentAlarmTime}`))
    .catch(() => alert(`Orario sveglia: ${currentAlarmTime}`));
}

function openAndroidAlarm() {
  if (!currentAlarmTime) {
    alert("Calcola prima gli orari.");
    return;
  }

  alert(`Imposta la sveglia alle ${currentAlarmTime}.`);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function eventStartToTime(event) {
  if (!event?.start) return null;
  if (event.start.dateTime) {
    const dt = new Date(event.start.dateTime);
    return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }
  return null;
}

function formatEventDate(event) {
  if (!event?.start) return "Data non disponibile";
  if (event.start.dateTime) {
    const dt = new Date(event.start.dateTime);
    return dt.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  if (event.start.date) {
    return new Date(event.start.date).toLocaleDateString("it-IT");
  }
  return "Data non disponibile";
}

function renderEvents() {
  if (!calendarEvents.length) {
    eventsEl.innerHTML = `<div class="status">Nessun evento trovato.</div>`;
    return;
  }

  eventsEl.innerHTML = calendarEvents.map((event, index) => {
    const time = eventStartToTime(event);
    return `
      <div class="event-item">
        <div class="event-title">${escapeHtml(event.summary || "Evento senza titolo")}</div>
        <div class="event-meta">${escapeHtml(formatEventDate(event))}</div>
        ${time ? `<button type="button" class="secondary use-event-btn" data-index="${index}">Usa questo orario</button>` : `<div class="status">Evento senza orario preciso.</div>`}
      </div>
    `;
  }).join("");

  document.querySelectorAll(".use-event-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const event = calendarEvents[Number(this.dataset.index)];
      const time = eventStartToTime(event);
      if (!time) return;
      dutyTimeEl.value = time;
      calculateTimes();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem("svegliaDutySettings");
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.dutyTime) dutyTimeEl.value = saved.dutyTime;
    if (saved.prepBeforeDuty !== undefined) prepBeforeDutyEl.value = saved.prepBeforeDuty;
    if (saved.travelMinutes !== undefined) travelMinutesEl.value = saved.travelMinutes;
    if (saved.alarmAdvance !== undefined) alarmAdvanceEl.value = saved.alarmAdvance;
  } catch (e) {}
}

function gapiLoaded() {
  gapi.load("client", initializeGapiClient);
}

async function initializeGapiClient() {
  if (!API_KEY || API_KEY.includes("INSERISCI_QUI")) {
    calendarStatus.textContent = "Inserisci API Key e Client ID in app.js.";
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
    calendarStatus.textContent = "Inserisci API Key e Client ID in app.js.";
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

async function handleAuthClick() {
  if (!tokenClient) {
    alert("Google Calendar non configurato correttamente.");
    return;
  }

  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      alert("Errore durante l'autorizzazione Google.");
      return;
    }

    signoutButton.style.display = "block";
    authorizeButton.textContent = "Aggiorna eventi";
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
  }

  calendarEvents = [];
  eventsEl.innerHTML = "";
  signoutButton.style.display = "none";
  authorizeButton.textContent = "Collega Google Calendar";
  calendarStatus.textContent = "Google Calendar disconnesso.";
}

async function listUpcomingEvents() {
  calendarStatus.textContent = "Caricamento eventi...";

  try {
    const response = await gapi.client.calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 20,
      orderBy: "startTime"
    });

    calendarEvents = response.result.items || [];
    calendarStatus.textContent = `${calendarEvents.length} eventi caricati.`;
    renderEvents();
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

window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;

loadSavedSettings();
