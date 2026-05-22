/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import logo from "./assets/logo.png";
import { useState, useEffect } from 'react';
import { db } from "./firebase";
import {
  collection,
  getDocs,
  setDoc,
  doc
} from "firebase/firestore";
import {
  Trophy,
  Calendar,
  Plus,
  Minus,
  ChevronRight,
  Settings,
  Shield,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

// Liste der offiziellen Teilnehmer laut Vorgabe
const INITIAL_PLAYERS = [
  'Daniel Fiedler',
  'Dominik Scheibel',
  'Eric Böhm',
  'Hans-Jürgen Potreck',
  'Jürgen Cornelius',
  'Klaus-Dieter Müller',
  'Sascha Cornelius',
  'Sascha Dilthey',
  'Steven Stahl',
  'Thorsten Wittich',
  'Tobi Kranz',
];

interface MatchdayScores {
  [playerName: string]: number;
}

interface Matchday {
  date: string; // YYYY-MM-DD
  scores: MatchdayScores;
}

interface PlayerStats {
  name: string;
  totalPoints: number; // Punkte gesamt (Summe aller gewonnenen Spiele)
  participations: number; // Anzahl teilgenommener Spieltage (Punkte > 0)
  avgPoints: number; // Durchschnitt Punkte pro Teilnahme
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'admin'>(
    'leaderboard'
  );
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

const ADMIN_PASSWORD = "dch24";
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Standardmäßig aktuelles Datum als YYYY-MM-DD
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Admin-Formular Status
  const [adminScores, setAdminScores] = useState<MatchdayScores>(() => {
    const initial: MatchdayScores = {};
    INITIAL_PLAYERS.forEach((p) => {
      initial[p] = 0;
    });
    return initial;
  });

  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Daten aus Firebase laden
useEffect(() => {
  const loadData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "matchdays"));

      const loadedMatchdays: Matchday[] = [];

      querySnapshot.forEach((docSnap) => {
        loadedMatchdays.push(docSnap.data() as Matchday);
      });

      loadedMatchdays.sort((a, b) =>
        b.date.localeCompare(a.date)
      );

      setMatchdays(loadedMatchdays);
    } catch (error) {
      console.error("Fehler beim Laden aus Firestore:", error);
    }
  };

  loadData();
}, []);
  // Helfer: Benachrichtigung anzeigen
  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success'
  ) => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Zähler inkrementieren/dekrementieren in der Admin-Ansicht
  const handleAdjustScore = (player: string, amount: number) => {
    setAdminScores((prev) => ({
      ...prev,
      [player]: Math.max(0, (prev[player] || 0) + amount),
    }));
  };

  // Textuelle Punkteeingabe
  const handleScoreChange = (player: string, val: string) => {
    const parsed = parseInt(val, 10);
    setAdminScores((prev) => ({
      ...prev,
      [player]: isNaN(parsed) ? 0 : Math.max(0, parsed),
    }));
  };

  // Spieltag sichern
// Spieltag sichern
const handleSaveMatchday = async () => {
  // Überprüfen, ob mindestens ein Spieler Punkte eingetragen hat (> 0)
  const hasPoints = Object.values(adminScores).some(
    (score) => score > 0
  );

  if (!hasPoints) {
    showToast(
      'Bitte tragen Sie mindestens bei einem Spieler Punkte ein (> 0).',
      'error'
    );
    return;
  }

  // Spieltag-Daten zusammenstellen
  const newMatchday: Matchday = {
    date: selectedDate,
    scores: { ...adminScores },
  };

  try {
    // In Firestore speichern
    await setDoc(
      doc(db, "matchdays", selectedDate),
      newMatchday
    );

    // Lokalen State aktualisieren
    setMatchdays((prev) => {
      const filtered = prev.filter(
        (m) => m.date !== selectedDate
      );

      const updated = [...filtered, newMatchday].sort(
        (a, b) => b.date.localeCompare(a.date)
      );

      return updated;
    });

    showToast(
      `Spieltag vom ${formatiereDatum(
        selectedDate
      )} erfolgreich gespeichert!`
    );

    // Formular zurücksetzen
    const resetScores: MatchdayScores = {};

    INITIAL_PLAYERS.forEach((p) => {
      resetScores[p] = 0;
    });

    setAdminScores(resetScores);

    setActiveTab('leaderboard');

  } catch (error) {
    console.error("Firestore Fehler:", error);

    showToast(
      "Fehler beim Speichern in Firebase.",
      "error"
    );
  }
};

  // Editieren eines bereits bestehenden Spieltags laden
  const handleLoadMatchdayToEdit = (matchday: Matchday) => {
    setSelectedDate(matchday.date);
    const scoresWithDefaults = { ...adminScores };
    INITIAL_PLAYERS.forEach((p) => {
      scoresWithDefaults[p] = matchday.scores[p] || 0;
    });
    setAdminScores(scoresWithDefaults);
    setActiveTab('admin');
    showToast(
      `Spieltag vom ${formatiereDatum(matchday.date)} geladen zum Bearbeiten.`,
      'success'
    );
  };

  // Datumsformatierung für deutsche Anzeige
  const formatiereDatum = (isoString: string) => {
    if (!isoString) return '';
    const [year, month, day] = isoString.split('-');
    return `${day}.${month}.${year}`;
  };

  // BERECHNUNGEN FÜR DIE RANGLISTE

  // 1. Anzahl stattgefundener Spieltage gesamt
  // Ein Spieltag zählt als stattgefunden, wenn mindestens für einen Spieler ein Wert > 0 hinterlegt wurde.
  const listActiveMatchdays = matchdays.filter((m) => {
    return Object.values(m.scores).some((score) => score > 0);
  });
  const totalMatchdaysNum = listActiveMatchdays.length;

  // 2. Statistiken pro Spieler aggregieren
  const playerStatsList: PlayerStats[] = INITIAL_PLAYERS.map((playerName) => {
    let totalPoints = 0;
    let participations = 0;

    listActiveMatchdays.forEach((m) => {
      const pScore = m.scores[playerName] || 0;
      if (pScore > 0) {
        totalPoints += pScore;
        participations += 1;
      }
    });

    const avgPoints =
      participations > 0
        ? parseFloat((totalPoints / participations).toFixed(2))
        : 0;

    return {
      name: playerName,
      totalPoints,
      participations,
      avgPoints,
    };
  });

  // 3. Sortierung der Rangliste
  // - Nach Punkten absteigend
  // - Bei Punktgleichheit nach Durchschnitt pro Teilnahme absteigend
  // - Falls immer noch gleich, alphabetisch
  const sortedLeaderboard = [...playerStatsList].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    if (b.avgPoints !== a.avgPoints) {
      return b.avgPoints - a.avgPoints;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col antialiased selection:bg-blue-500 selection:text-white">
      {/* Toast-Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm animate-bounce">
          <div
            className={`p-4 rounded-xl shadow-2xl border flex items-center gap-3 ${
              notification.type === 'success'
                ? 'bg-emerald-900/95 border-emerald-500 text-emerald-200'
                : 'bg-rose-950/95 border-rose-500 text-rose-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-bold">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header-Vereins-Banner */}
      <header className="bg-gradient-to-r from-blue-950 via-slate-900 to-slate-950 border-b border-blue-900/40 sticky top-0 z-30 shadow-md">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Integriertes, geometrisch-balanciertes Sport-League-Emblem */}
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center shadow-lg relative overflow-hidden shrink-0 border border-amber-300/35">
              <div className="absolute inset-0 bg-slate-950/10 rotate-45 transform origin-center"></div>
              <img
             src={logo}
             alt="DC Holzbock"
              className="w-10 h-10 object-contain relative z-10 rounded-lg"
/>
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-wider text-white">
                DC Holzbock Liga
              </h1>
              <p className="text-[10px] text-blue-400 font-mono tracking-widest uppercase">
                Rangliste & Admin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-blue-950/80 px-3 py-1.5 rounded-full border border-blue-900/55">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-mono font-bold text-blue-300">
              Spieltage: {totalMatchdaysNum}
            </span>
          </div>
        </div>
      </header>

      {/* Tab-Navigation / Hauptmenü */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 sticky top-[73px] z-20 backdrop-blur-md">
        <div className="max-w-md mx-auto grid grid-cols-2 p-1.5 gap-1.5">
          <button
            id="tab-leaderboard-btn"
            onClick={() => setActiveTab('leaderboard')}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm tracking-wide transition-all duration-200 uppercase ${
              activeTab === 'leaderboard'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Rangliste
          </button>

          <button
            id="tab-admin-btn"
            onClick={() => {
              if (isAdminUnlocked) {
                setActiveTab('admin');
                return;
              }
            
              const password = window.prompt('Bitte Admin-Passwort eingeben:');
            
              if (password === ADMIN_PASSWORD) {
                setIsAdminUnlocked(true);
                setActiveTab('admin');
              } else if (password !== null) {
                window.alert('Falsches Passwort');
              }
            }}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm tracking-wide transition-all duration-200 uppercase ${
              activeTab === 'admin'
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Settings className="w-4 h-4" />
            Admin-Bereich
          </button>
        </div>
      </div>

      {/* Hauptinhalt */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6 pb-24">
        {/* TAB 1: RANGLISTE */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {/* Saisondetails & Beschreibung */}
            <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-blue-400">
                <Shield className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Saison-Modus
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed font-medium">
                Jeden Freitag bis zur Weihnachtsfeier. Gewonnene Spiele ergeben
                je 1 Punkt. Sortierung absteigend nach Gesamtpunkten, bei
                Gleichheit entscheidet der Durchschnitt.
              </p>
            </div>

            {/* Ranglisten-Tabelle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">
                  Aktueller Stand
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  Stand: 21. Mai 2026
                </span>
              </div>

              <div className="space-y-2">
                {sortedLeaderboard.map((player, index) => {
                  const rank = index + 1;

                  // Individuelles Styling für Ränge 1, 2, 3
                  let rowStyle =
                    'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70';
                  let badgeStyle = 'text-slate-400 font-mono';
                  let scoreStyle = 'text-slate-200 font-bold';

                  if (rank === 1) {
                    rowStyle =
                      'bg-amber-950/45 border-l-4 border-l-amber-500 border-y border-r border-amber-900/50 hover:bg-amber-950/60';
                    badgeStyle =
                      'text-amber-500 font-black text-base drop-shadow-[0_1px_5px_rgba(245,158,11,0.2)]';
                    scoreStyle = 'text-amber-400 font-black text-xl';
                  } else if (rank === 2) {
                    rowStyle =
                      'bg-slate-800 border-l-4 border-l-slate-400 border-y border-r border-slate-700/50 hover:bg-slate-800/90';
                    badgeStyle = 'text-slate-300 font-black text-base';
                    scoreStyle = 'text-slate-100 font-semibold text-lg';
                  } else if (rank === 3) {
                    rowStyle =
                      'bg-orange-950/30 border-l-4 border-l-orange-500 border-y border-r border-orange-950/50 hover:bg-orange-950/50';
                    badgeStyle = 'text-orange-400 font-black text-base';
                    scoreStyle = 'text-orange-400 font-semibold text-lg';
                  }

                  return (
                    <div
                      key={player.name}
                      id={`player-row-${player.name
                        .replace(/\s+/g, '-')
                        .toLowerCase()}`}
                      className={`rounded-xl border p-3.5 transition-all duration-200 flex items-center justify-between ${rowStyle}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Platzierungs-Zahl */}
                        <div className="w-7 flex justify-center items-center shrink-0">
                          {rank <= 3 ? (
                            <div className="flex items-center gap-0.5">
                              <span className={badgeStyle}>{rank}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 font-bold">
                              {rank}
                            </span>
                          )}
                        </div>
                        {/* Name */}
                        <div className="truncate font-semibold text-sm text-slate-100">
                          {player.name}
                        </div>
                      </div>

                      {/* Punkte & Statistiken */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className={`font-mono ${scoreStyle}`}>
                            {player.totalPoints}{' '}
                            <span className="text-[10px] text-slate-500 font-sans">
                              Pkt.
                            </span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {player.participations}/{totalMatchdaysNum} Tage • Ø{' '}
                            {player.avgPoints.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bisherige Spieltage historisch einsehen */}
            {listActiveMatchdays.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest px-2">
                  Eingetragene Spieltage
                </h3>
                <div className="space-y-2">
                  {listActiveMatchdays.map((m) => (
                    <div
                      key={m.date}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold font-mono text-slate-300">
                          {formatiereDatum(m.date)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleLoadMatchdayToEdit(m)}
                        className="text-[10px] uppercase font-black tracking-wider text-slate-400 hover:text-blue-400 flex items-center gap-1 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-800/60"
                      >
                        Bearbeiten
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ADMIN BEREICH */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            {/* Header / Einweisung */}
            <div className="bg-red-950/20 border border-red-900/40 p-4 rounded-2xl flex gap-3">
              <Shield className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black uppercase text-red-400 tracking-wider">
                  Erfassung neuer Ergebnisse
                </h4>
                <p className="text-xs text-red-100/80 mt-1 leading-relaxed">
                  Date-Picker benutzen, um den Freitag oder das Datum
                  auszuwählen. Tragen Sie pro Spieler die gewonnenen Spiele ein
                  und klicken Sie am Ende auf Speichern.
                </p>
              </div>
            </div>

            {/* Datums-Auswahl */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Spieltag Datum
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="matchday-date-picker"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-800 border-2 border-slate-700/60 rounded-xl p-3.5 font-bold text-slate-100 focus:outline-none focus:border-red-500/80 transition-all font-mono"
                />
              </div>
            </div>

            {/* Spieler-Erfassungsliste */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest px-1">
                Gewonnene Spiele pro Spieler
              </h3>

              <div className="space-y-2.5">
                {INITIAL_PLAYERS.map((player) => {
                  const val = adminScores[player] || 0;
                  return (
                    <div
                      key={player}
                      className="bg-slate-800/35 border border-slate-800 rounded-xl p-3 flex justify-between items-center gap-4 hover:border-slate-700/50 transition-colors"
                    >
                      <span className="font-semibold text-sm text-slate-200 truncate">
                        {player}
                      </span>

                      {/* Mobile-freundliche Plus/Minus Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdjustScore(player, -1)}
                          className="w-10 h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-lg flex items-center justify-center border border-slate-700/80 cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <input
                          type="number"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          value={val === 0 ? '' : val}
                          onChange={(e) =>
                            handleScoreChange(player, e.target.value)
                          }
                          placeholder="0"
                          className="w-12 h-10 bg-slate-900 border border-slate-700 rounded-lg text-center font-bold text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                        />

                        <button
                          type="button"
                          onClick={() => handleAdjustScore(player, 1)}
                          className="w-10 h-10 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-lg flex items-center justify-center border border-slate-700/80 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Speicher-Button */}
            <button
              id="save-matchday-btn"
              onClick={handleSaveMatchday}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black py-4 rounded-xl shadow-xl shadow-red-950/20 active:scale-[0.98] transition-all uppercase tracking-widest text-base cursor-pointer border border-red-500/30 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Spieltag Speichern
            </button>
          </div>
        )}
      </main>

      {/* Footer / Copyright / Geometrisches Status-Margindekor */}
      <footer className="mt-auto border-t border-slate-800/80 py-4 bg-slate-950/40">
        <div className="max-w-md mx-auto text-center px-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
            Freitags-Rangliste • Vorweihnachts-Saison
          </p>
        </div>
      </footer>
    </div>
  );
}
