// Plik: main.js

// Importujemy potrzebne funkcje z naszych modułów
import { database, ref, set, onValue } from "./firebase.js";
import { showMessage } from "./ui.js";
import { waitForFamilyChart, createAndConfigureChart } from "./chart.js";

// Zmienna przechowująca instancję wykresu, dostępna w całym module
let f3ChartInstance = null;
let isFirstDataLoad = true;

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
    await set(databaseRef, dataToSave);
    showMessage("✅ Drzewo zostało pomyślnie zapisane!", "success");
  } catch (error) {
    console.error("🔥 Błąd podczas zapisu do Firebase:", error);
    showMessage(`❌ Błąd zapisu: ${error.message}`, "error");
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

// Wersja PO
document.addEventListener('family-chart-form-submitted', saveDataToFirebase);
console.log("✅ Ustawiono nasłuchiwanie na zapis po edycji w formularzu.");

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
      f3ChartInstance.updateTree({ initial: isFirstDataLoad });
      
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

