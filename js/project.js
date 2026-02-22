/**
 * project.js – zapis/wczytywanie projektu (localStorage + plik JSON)
 *
 * Format projektu:
 * {
 *   version: 1,
 *   room: { width, depth, height },
 *   items: [ { name, width, depth, height, floorHeight, color, opacity, isBlocked, x, z, rotation }, … ]
 * }
 */

import { items, addItem, removeItem } from './items.js';

const LS_KEY = 'roomPlanner_project';
const PROJECT_VERSION = 1;

// ---- Serializacja ----

function serializeProject(roomConfig) {
    return {
        version: PROJECT_VERSION,
        room: { ...roomConfig },
        items: items.map(item => ({
            name: item.name,
            width: item.width,
            depth: item.depth,
            height: item.height,
            floorHeight: item.floorHeight ?? 0,
            color: item.color,
            opacity: item.opacity,
            isBlocked: item.isBlocked,
            x: item.x,
            z: item.z,
            rotation: item.rotation ?? 0,
        }))
    };
}

// ---- Przywracanie projektu ----

function restoreProject(data, applyRoomCallback) {
    if (!data || data.version !== PROJECT_VERSION) {
        console.warn('[project] Nieznana wersja projektu:', data?.version);
        return false;
    }

    // Usuń stare elementy
    const ids = items.map(i => i.id);
    ids.forEach(id => removeItem(id));

    // Zastosuj konfigurację pokoju
    if (data.room && applyRoomCallback) {
        applyRoomCallback(data.room);
        // Zaktualizuj pola formularza
        const setVal = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.value = v;
        };
        setVal('room-width', data.room.width);
        setVal('room-depth', data.room.depth);
        setVal('room-height', data.room.height);
    }

    // Dodaj elementy
    if (Array.isArray(data.items)) {
        data.items.forEach(cfg => addItem(cfg));
    }

    return true;
}

// ---- localStorage ----

export function autosave(roomConfig) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(serializeProject(roomConfig)));
    } catch (e) {
        console.warn('[project] Autosave nieudany:', e);
    }
}

export function loadFromLocalStorage(applyRoomCallback) {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return false;
        return restoreProject(JSON.parse(raw), applyRoomCallback);
    } catch (e) {
        console.warn('[project] Wczytywanie z localStorage nieudane:', e);
        return false;
    }
}

// ---- Eksport do Schowka ----

export function exportToClipboard(roomConfig) {
    try {
        const data = serializeProject(roomConfig);
        const json = JSON.stringify(data, null, 2);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).then(() => {
                alert('Pomyślnie skopiowano kod projektu do schowka! Możesz go teraz wkleić w bezpieczne miejsce (np. do notatnika).');
            }).catch(err => {
                // Ręczny fallback
                prompt('Kopiowanie automatyczne zablokowane. Skopiuj poniższy tekst ręcznie:', json);
            });
        } else {
            prompt('Kopiowanie automatyczne niedostępne w tej przeglądarce. Skopiuj poniższy tekst ręcznie:', json);
        }
    } catch (e) {
        alert('Błąd generowania danych projektu: ' + e.message);
    }
}

// ---- Import ze Schowka ----

export async function importFromClipboard(applyRoomCallback, onDone) {
    try {
        let text = '';
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                text = await navigator.clipboard.readText();
            } else {
                throw new Error('No clipboard API');
            }
        } catch (err) {
            // macOS Safari lub brak uprawnień - ręczny fallback
            text = prompt("Nie udało się odczytać schowka automatycznie.\n\nWklej (Cmd+V) skopiowany wcześniej kod struktury projektu poniżej:");
            if (!text) return; // anulowano
        }

        if (!text || !text.trim().startsWith('{')) {
            alert('Schowek nie zawiera kodu projektu lub jest w błędnym formacie.');
            return;
        }

        const data = JSON.parse(text);
        const success = restoreProject(data, applyRoomCallback);
        if (success) {
            onDone?.();
            alert('Wczytywanie zakończone sukcesem!');
        } else {
            alert('Problem z kompatybilnością wygenerowanego kodu (zła wersja).');
        }
    } catch (e) {
        alert('Błąd podczas rozpoznawania danych: ' + e.message);
    }
}
