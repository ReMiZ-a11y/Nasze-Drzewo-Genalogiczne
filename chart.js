// Plik: chart.js

export const PERSON_FIELDS = [
  "gender", "first name", "last name", "avatar", "maiden", "birth year",
  "death year", "occupation", "location", "education", "nationality",
  "birth place", "death place", "marriage date", "email", "phone",
  "address", "notes"
];

export function waitForFamilyChart(timeout = 5000) {
  const chartObjectNames = ["f3", "familyChart", "FamilyChart"];
  return new Promise((resolve, reject) => {
    for (const name of chartObjectNames) {
      if (window[name]) return resolve(window[name]);
    }
    let waited = 0;
    const interval = setInterval(() => {
      for (const name of chartObjectNames) {
        if (window[name]) {
          clearInterval(interval);
          return resolve(window[name]);
        }
      }
      waited += 100;
      if (waited >= timeout) {
        clearInterval(interval);
        reject(new Error("Biblioteka family-chart nie załadowała się na czas."));
      }
    }, 100);
  });
}

export function createAndConfigureChart(f3) {
  const chart = f3
    .createChart("#FamilyChart", [])
    // ZMIANA ESTETYCZNA: Szybsze animacje dla lepszego odczucia
    .setTransitionTime(600)
    .setCardXSpacing(250)
    .setCardYSpacing(170) // Zwiększamy odstęp pionowy dla czytelności
    .setShowSiblingsOfMain(true)
    // ZMIANA ESTETYCZNA: Powrót do bardziej klasycznego układu pionowego
     .setOrientationHorizontal() // Zmieniono z .setOrientationVertical()
    .setDuplicateBranchToggle(true);


  const f3Card = chart
    .setCard(f3.CardHtml)
    .setCardDisplay([["first name", "last name", "maiden"], []])
    .setMiniTree(true)
    // ZMIANA ESTETYCZNA: Okrągłe karty wyglądają nowocześniej
    .setStyle("imageCircle")
    //.setMainId('c526e079-346c-4b37-a70c-09d3b06316c8')  f3Chart.updateMainId('Q43274')   '1' to ID osoby, którą chcesz ustawić jako główną
    .setOnHoverPathToMain()

  // Prosta konfiguracja edytora
  chart
    .editTree()
    .fixed(true)
    .setFields(PERSON_FIELDS)
    .setEditFirst(true)
    .setCardClickOpen(f3Card);

  return chart;
}

