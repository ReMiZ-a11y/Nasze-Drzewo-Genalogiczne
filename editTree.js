/**
 * f3EditTree - Klasa EditTree
 * Zapewnia kompleksowe możliwości edycji danych drzewa genealogicznego.
 * Wersja z mechanizmem powiadamiania o zmianie stanu (onStateChange).
 */
export class EditTree {
    /**
     * @param {object} initialTreeData Początkowe dane drzewa genealogicznego.
     * @param {function(object): void} [onStateChange] Funkcja zwrotna wywoływana po każdej zmianie danych.
     */
    constructor(initialTreeData, onStateChange = () => {}) {
        // Głęboka kopia danych, aby uniknąć modyfikacji oryginalnego obiektu
        this.treeData = JSON.parse(JSON.stringify(initialTreeData));
        
        // ZMIANA: Przechowujemy funkcję zwrotną
        this.onStateChange = onStateChange;

        // Śledzenie historii dla funkcji cofnij/ponów
        this.history = [JSON.stringify(this.treeData)];
        this.historyIndex = 0;

        console.log("Klasa EditTree zainicjalizowana.");
    }

    // --- Główne metody edycyjne ---

    addMember(personInfo, parentId = null) {
        if (!this._validateForm(personInfo)) {
            this._showModal("Walidacja nie powiodła się: Nieprawidłowe dane osoby.");
            return false;
        }
        
        const existing = this.treeData.people.find(p => p.id === personInfo.id);
        if (existing) {
            this._showModal(`Błąd: Osoba o ID ${personInfo.id} już istnieje.`);
            return false;
        }

        this.treeData.people.push(personInfo);
        console.log(`Dodano nowego członka: ${personInfo.name}`);

        this._saveState();
        return true;
    }

    editMember(personId, updatedInfo) {
        const personIndex = this.treeData.people.findIndex(p => p.id === personId);

        if (personIndex === -1) {
            this._showModal(`Błąd: Nie znaleziono osoby o ID ${personId}.`);
            return false;
        }

        this.treeData.people[personIndex] = { ...this.treeData.people[personIndex], ...updatedInfo };
        console.log(`Zedytowano członka o ID: ${personId}`);

        this._saveState();
        return true;
    }

    removeMember(personId) {
        const initialCount = this.treeData.people.length;
        this.treeData.people = this.treeData.people.filter(p => p.id !== personId);

        if (this.treeData.people.length === initialCount) {
            this._showModal(`Błąd: Nie znaleziono osoby o ID ${personId}.`);
            return false;
        }
        
        console.log(`Usunięto członka o ID: ${personId}`);
        
        this._saveState();
        return true;
    }

    // --- Śledzenie historii ---

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.treeData = JSON.parse(this.history[this.historyIndex]);
            console.log("Akcja cofnięta.");
            // ZMIANA: Powiadamiamy o zmianie stanu
            this.onStateChange(this.getCurrentTree());
        } else {
            console.log("Brak operacji do cofnięcia.");
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.treeData = JSON.parse(this.history[this.historyIndex]);
            console.log("Akcja ponowiona.");
            // ZMIANA: Powiadamiamy o zmianie stanu
            this.onStateChange(this.getCurrentTree());
        } else {
            console.log("Brak operacji do ponowienia.");
        }
    }

    // --- Prywatne metody pomocnicze ---

    _saveState() {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(JSON.stringify(this.treeData));
        this.historyIndex++;
        
        // ZMIANA: Powiadamiamy o zmianie stanu po każdej nowej akcji
        this.onStateChange(this.getCurrentTree());
    }

    _validateForm(data) {
        return data && data.id && data.name;
    }

    _showModal(message) {
        console.warn(`MODAL UI: ${message}`);
    }

    getCurrentTree() {
        // Zwracamy głęboką kopię, aby świat zewnętrzny nie mógł przypadkowo
        // zmodyfikować wewnętrznego stanu `treeData` bez użycia metod klasy.
        return JSON.parse(JSON.stringify(this.treeData));
    }
}