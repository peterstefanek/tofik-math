# Pravidlá hry — Tofík a cesta ku hviezdam

Tento dokument popisuje herné pravidlá, mechaniky a pedagogický zámer hry. **Udržiavaj ho aktuálny pri každej zmene hernej logiky.**

---

## Základný tok hry

1. Hráč vyberie obtiažnosť (**do 10**, **do 20** alebo **Pokročilé**)
2. Vyberie zvieratko a zadá mu meno
3. Prechádza levelmi po mape (vždy len jeden odomknutý naraz)
4. V každom leveli odpovie na 4 otázky
5. Získa 1–3 hviezdy podľa počtu chýb
6. Po dokončení všetkých levelov: výherná obrazovka

---

## Obtiažnostné módy

| Mód | Levely | Max hviezd | Typy úloh |
|-----|--------|------------|-----------|
| **do 10** | 6 | 18 | count, add5, rozklad, compare, add10, sequence |
| **do 20** | 7 | 21 | + addsub20 (7. level) |
| **pokrocile** | 7 | 21 | compare(1-18), rozklad20, seqstep, addsub20, peniaze, wordproblem, magic |

---

## Levely a typy úloh

| # | Meno | Ikona | Typ úlohy |
|---|------|-------|-----------|
| 1 | Lúka | 🌼 | `count` — počítanie predmetov |
| 2 | Sad | 🍎 | `add5` — sčítanie do 5 |
| 3 | Vodopád | 💧 | `rozklad` — rozklad čísla |
| 4 | Jazierko | 🐟 | `compare` — porovnávanie množstiev |
| 5 | Jaskyňa | 🐻 | `add10` — sčítanie do 10 |
| 6 | Vrchol | ⛰️ | `sequence` — číselné rady |
| 7 | Hviezdy | 🌟 | `addsub20` — sčítanie a odčítanie do 20 |

---

## Typy úloh — pravidlá generovania

### `count` — Počítanie
- Zobraz N predmetov (emoji), spýtaj sa koľko ich je
- Odpovede: 4 možnosti (správna + 3 distraktorov)
- Rozsah: 2–8 predmetov

### `add5` — Sčítanie do 5
- Rovnica tvaru `a + b = ?` alebo `? + b = c` alebo `a + ? = c`
- Výsledok nikdy neprekročí 5
- 60 % otázok hľadá výsledok, 40 % hľadá chýbajúci sčítanec

### `add10` — Sčítanie do 10
- Rovnaká logika ako `add5`, výsledok do 10
- Vizuál: emoji v skupinách po 5 (stratégia prechodu cez 10)

### `compare` — Porovnávanie
- Dve skupiny predmetov, hráč určí ktorá je väčšia
- **Variant tap:** kliknutie na väčšiu skupinu
- **Variant scale (váhy):** naklonienie telefónu k ťažšej strane
  - Správne naklonienie musí trvať 1 200 ms nepretržite
  - Vizuálna váha sa nakláňa podľa gyroskopu
  - Fallback tlačidlá ⬅️ / ➡️ ak nie sú dostupné senzory
- Obe skupiny musia byť rôzne veľké (nikdy a == b)

### `rozklad` — Rozklad čísla
- Celok = známa časť + neznáma časť (hráč dopĺňa neznámu)
- **Variant tree:** vizuálny stromček rozkladu
- **Variant shake:** fyzikálna simulácia fazúľ — zatrasenie telefónom rozhodí fazule do dvoch košíkov
  - Hráč odpovedá koľko fazúľ padlo do neznámeho košíka
  - Fyzika: gravitácia, odrazy od stien, posúvanie do košíka
  - Manuálne tlačidlo pre prípad bez senzorov

### `sequence` — Číselné rady
- 5 čísel v rade, jedno je prázdne (pozícia 1–3, nikdy prvé ani posledné)
- Hráč doplní chýbajúce číslo
- Krok radu: +1 (základný); pokročilý: +2 alebo +5

### `addsub20` — Sčítanie a odčítanie do 20
- 50 % sčítanie, 50 % odčítanie
- Sčítanie: výsledok prekračuje 10 (stratégia rozkladu)
- Odčítanie: menšiteľ 11–20, odčítanec 2–9
- Slot: 65 % hľadá výsledok, 35 % hľadá chýbajúci člen

---

## Hodnotenie — hviezdy

| Chyby v leveli | Hviezdy |
|---------------|---------|
| 0 | ⭐⭐⭐ |
| 1–2 | ⭐⭐ |
| 3+ | ⭐ |

- Chyba = každá nesprávna odpoveď (pre tú istú otázku možno opakovať)
- Level sa dá znovu hrať (mapa umožňuje návrat na dokončené levely)
- Hviezdy sa ukladajú, zobrazujú sa na mape

---

## Senzorové mechaniky

| Senzor | Použitie | Fallback |
|--------|---------|----------|
| Gyroskop (`deviceorientation`, gamma os) | Naklonenie váh (`compare scale`) | Tlačidlá ⬅️ ➡️ |
| Akcelerometer (`devicemotion`) | Zatrasenie telefónom (`rozklad shake`) | Tlačidlo "Kliknite tu" |

- iOS 13+: vyžaduje explicitný súhlas používateľa (`DeviceOrientationEvent.requestPermission`)
- Pohybové mechaniky sú vždy doplnkové — hra funguje aj bez senzorov

---

## Zvuky (Tone.js, syntetizované)

| Udalosť | Zvuk |
|---------|------|
| Klik na tlačidlo | `tap` — krátky tón C5 |
| Správna odpoveď | `correct` — arpeggio C5–E5–G5 |
| Nesprávna odpoveď | `wrong` — G4→E4 (mäkký, nie disonantný) |
| Stamp animácia | `pop` — sweep E5→A5 |
| Hviezda (1./2./3.) | `star` — MetalSynth ping, výška rastie s indexom |
| Dokončenie levelu | `level-complete` — 4-tónová fanfára |
| Výhra hry | `game-complete` — fanfára + sparkle arpeggio |
| Pozdrav zvieratka | `pet-greet` — D4→F4 |
| Zatrasenie fazúľ | `shake-rattle` — biely šum |
| Usadenie fazule | `bean-drop` — MembraneSynth tok |
| Naklonenie váh | `tilt-tone` — sínusový oscilátor 220–440 Hz |

Zvuky sa dajú stlmiť / regulovať z mapy (🔊 ikona) alebo zo sekcie Pre rodiča.

---

## Štatistiky (localStorage)

Zbierajú sa automaticky, viditeľné v "Pre rodiča":

- Celkový počet odpovedaných otázok
- Úspešnosť na prvý pokus (%)
- Celkový čas hrania
- Priemer sekúnd na otázku
- Séria aktívnych dní (streak)
- Počet chýb spolu
- Rozpad podľa zručnosti (typ úlohy): úspešnosť, priemerný čas, počet chýb
- Posledných 10 chýb s detailom

Dáta sa neukladajú nikam mimo zariadenie.

---

## Ukladanie (localStorage keys)

| Kľúč | Obsah |
|------|-------|
| `tofik-game-v1` | Postup hry (pet, mód, hviezdy, done per level) |
| `tofik-stats-v1` | Štatistiky pokusov (posledných 200) |
| `tofik-audio-v1` | Nastavenia zvuku (mute, volume) |
