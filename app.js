let events = [];

function calcola() {
    const dutyInput = document.getElementById('dutyTime').value;
    if (!dutyInput) return alert('Inserisci orario duty!');
    
    const duty = new Date(`2026-01-01T${dutyInput}`);
    const presentazione = new Date(duty.getTime() - 10 * 60000); // -10 min
    const uscitaCasa = new Date(presentazione.getTime() - 15 * 60000); // -15 min
    const sveglia = new Date(uscitaCasa.getTime() - 35 * 60000); // -35 min
    
    const formatTime = (date) => date.toTimeString().slice(0,5);
    
    document.getElementById('results').innerHTML = `
        <div class="result">
            <strong>Orario Presentazione (Goal):</strong> <time>${formatTime(presentazione)}</time>
            <strong>Uscita di Casa:</strong> <time>${formatTime(uscitaCasa)}</time>
            <strong>Sveglia:</strong> <time>${formatTime(sveglia)}</time>
        </div>
    `;
    
    document.getElementById('alarmBtn').style.display = 'block';
    localStorage.setItem('ultimiCalcoli', JSON.stringify({duty: dutyInput, sveglia: formatTime(sveglia)}));
}

function impostaSveglia() {
    if ('Notification' in window && Notification.permission === 'granted') {
        const saved = JSON.parse(localStorage.getItem('ultimiCalcoli') || '{}');
        new Notification('Sveglia impostata!', {body: `Ore ${saved.sveglia} per duty!`, icon: '🛫'});
    } else {
        Notification.requestPermission().then(() => impostaSveglia());
    }
    // Copia sveglia negli appunti
    navigator.clipboard.writeText(localStorage.getItem('ultimiCalcoli')?.sveglia || '');
    alert('Sveglia copiata negli appunti! Impostala su Android.');
}

async function loadEvents() {
    document.getElementById('loader').style.display = 'block';
    // Simulazione eventi duty (per produzione, integra Google API con OAuth)
    // Vedi note per setup completo
    setTimeout(() => {
        events = [
            {summary: 'Duty FCO-MXP 06:00', start: '06:00'},
            {summary: 'Duty MXP-FCO 14:30', start: '14:30'}
        ];
        document.getElementById('events').innerHTML = events.map(e => 
            `<div class="event">
                ${e.summary} → <button onclick="document.getElementById('dutyTime').value='${e.start}';calcola();">Usa questo</button>
            </div>`
        ).join('');
        document.getElementById('loader').style.display = 'none';
    }, 1000);
}

// Carica ultimi calcoli
window.onload = () => {
    const saved = JSON.parse(localStorage.getItem('ultimiCalcoli') || '{}');
    if (saved.duty) document.getElementById('dutyTime').value = saved.duty;
};
