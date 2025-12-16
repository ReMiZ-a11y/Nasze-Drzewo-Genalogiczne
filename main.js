// Plik: main.js

// Importujemy potrzebne funkcje z naszych modułów
import { database, ref, set, onValue } from "./firebase.js";
import { showMessage } from "./ui.js";
import { waitForFamilyChart, createAndConfigureChart } from "./chart.js";

// Zmienna przechowująca instancję wykresu, dostępna w całym module
let f3ChartInstance = null;
let isFirstDataLoad = true;
// When we save data we want to keep the same person visible as "main".
let lastSavedMainId = null;
let justSaved = false;
const persistedMainKey = 'f3_last_main_id';

/**
 * Pobiera aktualne dane z wykresu i zapisuje je w Firebase.
 */
async function saveDataToFirebase() {
  if (!f3ChartInstance) {
    showMessage("Błąd: Instancja wykresu nie jest gotowa.", "error");
    return;
  }

  // Pobieramy wszystkie dane z magazynu biblioteki
  const chartDataArray = f3ChartInstance.store.getData();
  
  if (!chartDataArray || chartDataArray.length === 0) {
    showMessage("Drzewo jest puste. Nie ma czego zapisywać.", "info");
    return;
  }
  
  // Konwertujemy tablicę na obiekt dla optymalnej struktury w Firebase
  const dataToSave = chartDataArray.reduce((obj, person) => {
    const { id, ...rest } = person;
    obj[id] = rest;
    return obj;
  }, {});

  console.log("🔄 Zapisuję zmiany w Firebase...", dataToSave);
  showMessage("Zapisywanie...", "info");

  try {
    // Odniesienie do korzenia bazy danych
    const databaseRef = ref(database, '/id');
    // remember current main id so after saving we can restore it instead of showing a random person
    try {
      if (f3ChartInstance && typeof f3ChartInstance.getMainId === 'function') {
        lastSavedMainId = f3ChartInstance.getMainId();
        justSaved = !!lastSavedMainId;
      }
    } catch (e) {
      console.warn('Could not read current main id before save', e);
      lastSavedMainId = null;
      justSaved = false;
    }
    await set(databaseRef, dataToSave);
    showMessage("✅ Drzewo zostało pomyślnie zapisane!", "success");
      // persist chosen main id across reloads
      try {
        if (lastSavedMainId) localStorage.setItem(persistedMainKey, lastSavedMainId);
      } catch (e) {
        console.warn('Could not persist main id to localStorage', e);
      }
    // keep lastSavedMainId until the onValue listener processes the update
  } catch (error) {
    console.error("🔥 Błąd podczas zapisu do Firebase:", error);
    showMessage(`❌ Błąd zapisu: ${error.message}`, "error");
    // reset on error
    lastSavedMainId = null;
    justSaved = false;
  }
}

/**
 * Główna funkcja uruchamiająca aplikację.
 */
async function main() {
  try {
    const f3 = await waitForFamilyChart();
    console.log("✅ Biblioteka family-chart załadowana.");

    // Inicjalizacja wykresu
    f3ChartInstance = createAndConfigureChart(f3);

    // --- Wyszukiwarka osób (imie + nazwisko) ---
    (function setupPersonSearch(){
      const input = document.getElementById('person-search');
      const results = document.getElementById('search-results');
      const clearBtn = document.getElementById('search-clear');

      if (!input || !results) return;

      function getDataArray(){
        try {
          return (f3ChartInstance && f3ChartInstance.store && f3ChartInstance.store.getData()) || [];
        } catch (e){
          return [];
        }
      }

      function getField(p, fieldNames){
        // fieldNames: array of possible keys in order
        if (!p) return '';
        // plain fields on root
        for (const k of fieldNames) {
          if (p[k]) return String(p[k]);
        }
        // nested under p.data
        if (p.data) {
          for (const k of fieldNames) {
            if (p.data[k]) return String(p.data[k]);
          }
        }
        // sometimes values may be nested one level deeper
        if (p[0] && typeof p[0] === 'object') {
          for (const k of fieldNames) {
            if (p[0][k]) return String(p[0][k]);
          }
        }
        return '';
      }

      function formatName(p){
        const fn = getField(p, ['first name', 'first_name', 'first']);
        const ln = getField(p, ['last name', 'last_name', 'last']);
        const name = (fn + (ln ? ' ' + ln : '')).trim();
        if (name) return name;
        // fallback to id or any label
        return getField(p, ['id']) || (p && p.id) || '';
      }

      function clearResults(){
        results.innerHTML = '';
        results.classList.remove('show');
      }

      function showResults(list){
        results.innerHTML = '';
        if (!list.length) {
          const li = document.createElement('li');
          li.textContent = 'Brak wyników';
          li.setAttribute('aria-disabled', 'true');
          li.style.opacity = '0.6';
          results.appendChild(li);
          results.classList.add('show');
          return;
        }
        for (const p of list) {
          const li = document.createElement('li');
          li.textContent = formatName(p);
          // try to get id from multiple places
          const pid = p && (p.id || p.data && p.data.id || p['id']);
          if (pid) li.dataset.id = pid;
          li.addEventListener('click', () => {
            // Ustaw główną osobę w wykresie
            try {
              const idToUse = li.dataset.id;
              if (idToUse && f3ChartInstance && f3ChartInstance.updateMainId) {
                f3ChartInstance.updateMainId(idToUse);
                f3ChartInstance.updateTree({ initial: false });
                try { localStorage.setItem(persistedMainKey, idToUse); } catch(e){}
              }
            } catch (e) {
              console.warn('Nie udało się przejść do osoby', e);
            }
            input.value = li.textContent;
            clearResults();
          });
          results.appendChild(li);
        }
        results.classList.add('show');
      }

      function searchQuery(q){
        if (!q) { clearResults(); return; }
        const all = getDataArray();
        const qq = q.toLowerCase();
        const matches = all.filter(p => {
          const fn = getField(p, ['first name', 'first_name', 'first']).toLowerCase();
          const ln = getField(p, ['last name', 'last_name', 'last']).toLowerCase();
          const full = (fn + ' ' + ln).trim();
          return (full && full.includes(qq)) || (fn && fn.includes(qq)) || (ln && ln.includes(qq));
        }).slice(0, 20);
        showResults(matches);
      }

      // Debounce
      let debounceTimer = null;
      input.addEventListener('input', (e) => {
        const v = e.target.value;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => searchQuery(v.trim()), 200);
      });

      clearBtn && clearBtn.addEventListener('click', () => {
        input.value = '';
        clearResults();
        input.focus();
      });

      // close when clicking outside
      document.addEventListener('click', (ev) => {
        if (!results.contains(ev.target) && ev.target !== input) clearResults();
      });
      // Random person button
      const randomBtn = document.getElementById('random-person');
      if (randomBtn) {
        randomBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          const all = getDataArray();
          if (!all || all.length === 0) {
            showMessage && showMessage('Brak danych do wylosowania', 'info');
            return;
          }
          // choose only those with an id
          const candidates = all.filter(p => p && (p.id || (p.data && p.data.id)));
          if (candidates.length === 0) {
            showMessage && showMessage('Brak odpowiednich rekordów', 'info');
            return;
          }
          const pick = candidates[Math.floor(Math.random()*candidates.length)];
          const pid = pick.id || (pick.data && pick.data.id) || pick['id'];
          const name = formatName(pick);
          if (pid && f3ChartInstance && f3ChartInstance.updateMainId) {
            try {
              f3ChartInstance.updateMainId(pid);
              f3ChartInstance.updateTree({ initial: false });
              try { localStorage.setItem(persistedMainKey, pid); } catch(e){}
              showMessage && showMessage(`Wylosowano: ${name}`, 'success');
              // add small highlight to chart container
              const chartEl = document.getElementById('FamilyChart');
              chartEl && chartEl.classList.add('random-highlight');
              setTimeout(()=> chartEl && chartEl.classList.remove('random-highlight'), 900);
            } catch (e) {
              console.warn('Błąd przy ustawianiu wylosowanej osoby', e);
              showMessage && showMessage('Błąd przy ustawianiu osoby', 'error');
            }
          }
        });
      }
    })();

    // Persist current main id on unload so a refresh/close keeps the same person
    window.addEventListener('beforeunload', () => {
      try {
        if (f3ChartInstance && typeof f3ChartInstance.getMainId === 'function') {
          const mid = f3ChartInstance.getMainId();
          if (mid) localStorage.setItem(persistedMainKey, mid);
        }
      } catch (e) {
        // ignore
      }
    });

    // Wersja PO
    document.addEventListener('family-chart-form-submitted', saveDataToFirebase);
    console.log("✅ Ustawiono nasłuchiwanie na zapis po edycji w formularzu.");

    // --- Dynamiczne dopasowanie wysokości wykresu ---
    function adjustChartHeight(){
      try {
        const chartEl = document.getElementById('FamilyChart');
        if (!chartEl) return;
        const header = document.querySelector('.site-header');
        const headerH = header ? header.getBoundingClientRect().height : 0;
        const gap = 16; // dodatkowa przestrzeń
        const newH = Math.max(400, window.innerHeight - headerH - gap);
        chartEl.style.height = newH + 'px';
        chartEl.style.minHeight = newH + 'px';
      } catch (e) {
        console.warn('adjustChartHeight error', e);
      }
    }

    // debounce helper
    let _resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(adjustChartHeight, 120);
    });

    // run now
    adjustChartHeight();

    // --- Persistent visible scrollbar for form/menu ---
    function initPersistentScrollbar(){
      const cont = document.querySelector('.f3-form-cont');
      const form = document.querySelector('.f3-form');
      if (!cont || !form) return;

      // create track/thumb elements if not present
      if (!cont.querySelector('.persistent-scrollbar-track')){
        const track = document.createElement('div');
        track.className = 'persistent-scrollbar-track';
        const thumb = document.createElement('div');
        thumb.className = 'persistent-scrollbar-thumb';
        track.appendChild(thumb);
        cont.appendChild(track);
      }

      const track = cont.querySelector('.persistent-scrollbar-track');
      const thumb = cont.querySelector('.persistent-scrollbar-thumb');

      function updateThumb(){
        const scrollEl = form;
        const h = scrollEl.clientHeight;
        const scrollHeight = scrollEl.scrollHeight;
        if (scrollHeight <= h) {
          cont.classList.add('small-scroll');
          return;
        } else {
          cont.classList.remove('small-scroll');
        }
        const trackRect = track.getBoundingClientRect();
        const trackHeight = trackRect.height;
        const thumbHeight = Math.max(24, (h / scrollHeight) * trackHeight);
        const maxTop = trackHeight - thumbHeight;
        const scrollRatio = scrollEl.scrollTop / (scrollHeight - h);
        const top = Math.round(scrollRatio * maxTop);
        thumb.style.height = thumbHeight + 'px';
        thumb.style.transform = `translateY(${top}px)`;
      }

      // update on scroll and resize
      form.addEventListener('scroll', updateThumb, { passive: true });
      window.addEventListener('resize', updateThumb);
      // initial
      setTimeout(updateThumb, 50);
    }

    // watch for panel creation/opening (library might create it later)
    const obs = new MutationObserver((mutations) => {
      if (document.querySelector('.f3-form-cont')) {
        initPersistentScrollbar();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // --- Translate form labels/controls from English to Polish (display only) ---
    const TRANSLATIONS = {
      'gender': 'Płeć',
      'male': 'Mężczyzna',
      'female': 'Kobieta',
      'first name': 'Imię',
      'last name': 'Nazwisko',
      'avatar': 'Avatar',
      'maiden': 'Nazwisko panieńskie',
      'birth year': 'Data urodzenia',
      'death year': 'Rok śmierci',
      'occupation': 'Zawód',
      'location': 'Miejsce',
      'education': 'Wykształcenie',
      'nationality': 'Obywatelstwo',
      'birth place': 'Miejsce urodzenia',
      'death place': 'Miejsce śmierci',
      'marriage date': 'Data ślubu',
      'email': 'Email',
      'phone': 'Telefon',
      'address': 'Adres',
      'notes': 'Notatki',

      'cancel': 'Anuluj',
      'submit': 'Zapisz',
      'delete': 'Usuń',
      'remove relation': 'Usuń relację',
      'remove relative': 'Usuń relację'
    };

    function translateString(s){
      if (!s) return s;
      const key = s.trim().toLowerCase();
      return TRANSLATIONS[key] || null;
    }

    function translateFormOnce(form){
      if (!form) return;
      // labels and field titles
      const labelSelectors = ['label', '.f3-info-field-label', '.f3-form-field label', '.f3-form-title'];
      labelSelectors.forEach(sel => {
        form.querySelectorAll(sel).forEach(el => {
          const txt = el.textContent || el.innerText || '';
          const t = translateString(txt);
          if (t) el.textContent = t;
        });
      });

      // input placeholders
      form.querySelectorAll('input, textarea, select').forEach(inp => {
        if (inp.placeholder){
          const t = translateString(inp.placeholder);
          if (t) inp.placeholder = t;
        }
      });

      // radio/option labels (usually <label> elements next to inputs)
      form.querySelectorAll('label').forEach(lbl => {
        const txt = lbl.textContent || '';
        const t = translateString(txt);
        if (t) lbl.textContent = t;
      });

      // buttons
      form.querySelectorAll('button, .f3-delete-btn, .f3-remove-relative-btn').forEach(btn => {
        const txt = (btn.textContent || btn.innerText || '').trim();
        const t = translateString(txt);
        if (t) btn.textContent = t;
      });
    }

    // continuous observer to translate newly added nodes inside form
    function observeAndTranslate(){
      const container = document.body;
      const mo = new MutationObserver((mutations) => {
        for (const m of mutations){
          for (const node of m.addedNodes){
            if (!(node instanceof HTMLElement)) continue;
            // if a form appeared
            if (node.matches && node.matches('.f3-form') || node.querySelector && node.querySelector('.f3-form')){
              const form = node.matches && node.matches('.f3-form') ? node : node.querySelector('.f3-form');
              translateFormOnce(form);
            }
            // if the form container was added
            if (node.matches && node.matches('.f3-form-cont') ){
              const form = node.querySelector('.f3-form') || node;
              translateFormOnce(form);
            }
          }
        }
      });
      mo.observe(container, { childList: true, subtree: true });

      // initial translate if already present
      const existingForm = document.querySelector('.f3-form');
      if (existingForm) translateFormOnce(existingForm);
    }

    observeAndTranslate();

    // Nasłuchujemy na zmiany w całej bazie danych
    const databaseRef = ref(database, "/id");
    onValue(databaseRef, async (snapshot) => {
      let dataForChart = [];
      if (snapshot.exists()) {
        const rawData = snapshot.val();
        console.log("📦 Dane z Firebase:", rawData);
        // Konwertujemy obiekt z Firebase z powrotem na tablicę
        dataForChart = Object.keys(rawData).map(key => ({ id: key, ...rawData[key] }));
      } else {
        console.log("🟢 Baza danych jest pusta.");
      }

      // Aktualizujemy wykres danymi z bazy
      await f3ChartInstance.updateData(dataForChart);

      // Ustaw punkt główny: jeśli przed zapisem użytkownik edytował osobę, przywróć ją.
      // W przeciwnym razie (np. przy odświeżeniu strony) ustaw losową osobę jak wcześniej.
      try {
        if (dataForChart && dataForChart.length > 0) {
          // priority: if we just saved, restore that one; else if a persisted id exists use it; otherwise random
          const persistedId = (() => {
            try { return localStorage.getItem(persistedMainKey); } catch(e){ return null; }
          })();

          if (justSaved && lastSavedMainId) {
            const exists = dataForChart.find(p => (p.id === lastSavedMainId) || (p.data && p.data.id === lastSavedMainId));
            if (exists && f3ChartInstance && typeof f3ChartInstance.updateMainId === 'function') {
              f3ChartInstance.updateMainId(lastSavedMainId);
            } else {
              // fallback to random if the saved id isn't present in returned data
              const randIndex = Math.floor(Math.random() * dataForChart.length);
              const candidate = dataForChart[randIndex] || {};
              const randId = candidate.id || (candidate.data && candidate.data.id) || null;
              if (randId && f3ChartInstance && typeof f3ChartInstance.updateMainId === 'function') {
                f3ChartInstance.updateMainId(randId);
              }
            }
          } else if (persistedId) {
            const existsP = dataForChart.find(p => (p.id === persistedId) || (p.data && p.data.id === persistedId));
            if (existsP && f3ChartInstance && typeof f3ChartInstance.updateMainId === 'function') {
              f3ChartInstance.updateMainId(persistedId);
            } else {
              // fallback to random
              const randIndex = Math.floor(Math.random() * dataForChart.length);
              const candidate = dataForChart[randIndex] || {};
              const randId = candidate.id || (candidate.data && candidate.data.id) || null;
              if (randId && f3ChartInstance && typeof f3ChartInstance.updateMainId === 'function') {
                f3ChartInstance.updateMainId(randId);
              }
            }
          } else {
            const randIndex = Math.floor(Math.random() * dataForChart.length);
            const candidate = dataForChart[randIndex] || {};
            const randId = candidate.id || (candidate.data && candidate.data.id) || null;
            if (randId && f3ChartInstance && typeof f3ChartInstance.updateMainId === 'function') {
              f3ChartInstance.updateMainId(randId);
            }
          }
        }
      } catch (e) {
        console.warn('Nie udało się ustawić punktu głównego:', e);
      }

      f3ChartInstance.updateTree({ initial: isFirstDataLoad });
      
      // If we just restored the main id after a save, reset the flag so subsequent
      // realtime updates behave normally (e.g. manual refresh will pick random).
      if (justSaved) {
        justSaved = false;
        lastSavedMainId = null;
      }

      if (!isFirstDataLoad) {
        showMessage("🔄 Wykres zsynchronizowany z Firebase!", "info");
      }
      isFirstDataLoad = false;
    }, (error) => {
      console.error("Błąd nasłuchiwania Firebase:", error);
      showMessage(`⚠️ Błąd połączenia: ${error.message}`, "error");
    });

  } catch (err) {
    console.error("Krytyczny błąd inicjalizacji:", err);
    showMessage(`❌ Inicjalizacja nie powiodła się: ${err.message}`, "error");
  }
}

// Uruchomienie aplikacji
main();

