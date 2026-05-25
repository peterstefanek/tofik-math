# Pravidlá hry — Tofík a cesta ku hviezdam

Tento dokument popisuje herné pravidlá, mechaniky a pedagogický zámer hry. **Udržiavaj ho aktuálny pri každej zmene hernej logiky.**

---

## Základný tok hry

1. Hráč vyberie obtiažnosť (**do 10**, **do 20** alebo **Pokročilé**)
2. Vyberie zvieratko a zadá mu meno
3. Prechádza levelmi po mape (vždy len jeden odomknutý naraz)
4. V každom leveli odpovie na 4 otázky
5. Získa 1–3 hviezdy podľa počtu chýb
6. Po dosiahnutí 3 hviezd (bez chyby) sa odomkne **bonusová otázka** (15 s časomiera)
7. Po dokončení všetkých levelov: výherná obrazovka

---

## Obtiažnostné módy

| Mód | Levely | Max hviezd | Typy úloh |
|-----|--------|------------|-----------|
| **do 10** | 6 | 18 + bonusy | count, add5, rozklad, compare, add10, sequence |
| **do 20** | 7 | 21 + bonusy | + addsub20 (7. level) |
| **pokrocile** | 7 | 21 + bonusy | compare(1–18), rozklad20, seqstep, addsub20, peniaze, wordproblem, magic |

---

## Levely a typy úloh

### Módy `do10` a `do20`

| # | Meno | Ikona | Typ úlohy |
|---|------|-------|-----------|
| 1 | Lúka | 🌼 | `count` — počítanie predmetov |
| 2 | Sad | 🍎 | `add5` — sčítanie do 5 |
| 3 | Vodopád | 💧 | `rozklad` — rozklad čísla |
| 4 | Jazierko | 🐟 | `compare` — porovnávanie množstiev |
| 5 | Jaskyňa | 🐻 | `add10` — sčítanie do 10 |
| 6 | Vrchol | ⛰️ | `sequence` — číselné rady |
| 7 | Hviezdy | 🌟 | `addsub20` — sčítanie a odčítanie do 20 (iba `do20`) |

### Mód `pokrocile`

| # | Meno | Ikona | Typ úlohy |
|---|------|-------|-----------|
| 1 | Lúka | 🌼 | `compare` — porovnávanie v rozsahu 1–18 |
| 2 | Sad | 🍎 | `rozklad20` — rozklad čísel 11–20 |
| 3 | Vodopád | 💧 | `seqstep` — postupnosti s krokom +2/+3/+4 |
| 4 | Jazierko | 🐟 | `addsub20` — sčítanie a odčítanie do 20 |
| 5 | Jaskyňa | 🐻 | `peniaze` — počítanie euromincí a bankoviek |
| 6 | Vrchol | ⛰️ | `wordproblem` — slovné úlohy |
| 7 | Hviezdy | 🌟 | `magic` — magický štvorec |

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
- Rozsah hodnôt: 1–8 (módy `do10`/`do20`), 1–18 (mód `pokrocile`)
- **Variant tap:** kliknutie na väčšiu skupinu
- **Variant scale (váhy):** naklonienie telefónu k ťažšej strane
  - Správne naklonienie musí trvať 1 200 ms nepretržite
  - Vizuálna váha sa nakláňa podľa gyroskopu
  - Fallback tlačidlá ⬅️ / ➡️ ak nie sú dostupné senzory
- Obe skupiny musia byť rôzne veľké (nikdy a == b)

### `rozklad` — Rozklad čísla

- Celok = známa časť + neznáma časť (hráč dopĺňa neznámu)
- Celkový počet fazúľ je prominentne zobrazený nad inštrukciou
- **Variant tree:** vizuálny stromček rozkladu
- **Variant shake:** fyzikálna simulácia fazúľ — zatrasenie telefónom rozhodí fazule do dvoch košíkov
  - Hráč odpovedá koľko fazúľ padlo do neznámeho košíka
  - Fyzika: gravitácia, odrazy od stien, posúvanie do košíka
  - Manuálne tlačidlo pre prípad bez senzorov

### `sequence` — Číselné rady

- 5 čísel v rade, jedno je prázdne (pozícia 1–3, nikdy prvé ani posledné)
- Hráč doplní chýbajúce číslo
- Krok radu: +1 (základný)

### `addsub20` — Sčítanie a odčítanie do 20

- 50 % sčítanie, 50 % odčítanie
- Sčítanie: výsledok prekračuje 10 (stratégia rozkladu)
- Odčítanie: menšiteľ 11–20, odčítanec 2–9
- Slot: 65 % hľadá výsledok, 35 % hľadá chýbajúci člen

### `rozklad20` — Rozklad čísel 11–20

- `total` ∈ {11..20}, `answer` ∈ {1..min(10, total−1)} (náhodné), `part = total − answer`
- Prvá časť rozkladu nie je vždy 10 — mení sa podľa vygenerovaného `answer`
- Vizuál: stromček s `part` (známa vetva, max 10 bodiek) a `?` (neznáma vetva, max 10 bodiek)
- Prompt: „Koľko chýba do {total}?"

### `seqstep` — Postupnosti s krokom

- 5 čísel v rade, jedno je prázdne (pozícia 1–3)
- Krok: +2 (tier 0), +2 alebo +3 (tier 1), +3 alebo +4 (tier 2)
- Začiatok a krok volené tak, aby sekvencia zostala ≤ 20
- Prompt: „Aké číslo chýba?"

### `peniaze` — Počítanie euromincí a bankoviek

- Hodnoty: mince 1 € a 2 €, bankovky 5 € a 10 €
- 2–4 náhodné položky, súčet ≤ 20 €
- **Interakcia:** zobrazí sa prasiatko 🐷 s inštrukciou „Rozbi prasiatko"; kliknutím sa spustí animácia rozbíjania a fyzikálna simulácia — mince a bankovky sa rozsypú po ploche
- Vizuál: mince a bankovky vizuálne odlíšené veľkosťou aj farbou (1 € menší kruh, 2 € väčší; 5 € zelená bankovka, 10 € modrá)
- Po usadení sa zobrazia tlačidlá s možnosťami
- Fallback: tlačidlá sa zobrazia aj bez fyzikálnej animácie (po 3 s)
- Prompt: „Koľko eur máš v prasiatku?"

### `wordproblem` — Slovné úlohy

- Banka 8 šablón (4 sčítanie, 4 odčítanie), výsledok ∈ {0..20}
- Emoji daného predmetu je vložené priamo do textu otázky za každým číslom
- Prvé číslo `a` je vždy ≥ 5 (aby sedelo skloňovanie genitívu plurálu)
- **Nápoveda** (skrytá, na vyžiadanie tlačidlom „💡 Zobraziť nápovedu"):
  - Sčítanie: skupina A ikon + symbol `+` + skupina B ikon
  - Odčítanie: všetky A ikony, posledných B je preškrtnutých (znázornenie odobratia)
- Šablóny:

| Emoji | Operácia | Rozsah a | Rozsah b |
| --- | --- | --- | --- |
| 🍪 keksíky | + | 5–11 | 2–7 |
| ✏️ ceruzky | − | 8–15 | 2–7 |
| 🍏 jabĺka | + | 5–11 | 3–9 |
| 🐦 vtáky | − | 10–17 | 3–9 |
| 🧁 buchtičky | − | 10–16 | 2–7 |
| 🔴 guličky | + | 6–14 | 2–7 |
| 🏷️ nálepky | − | 10–17 | 2–8 |
| 🌰 gaštany | + | 5–13 | 2–8 |

### `magic` — Magický štvorec

- Banka 6 preddefinovaných mriežok 3×3 (súčty riadkov aj stĺpcov rovnaké)
- Jedno pole je prázdne (`?`), hráč ho doplní
- Prompt: „Aké číslo chýba v magickom štvorci?"
- **Nápoveda** (skrytá, na vyžiadanie tlačidlom „💡 Potrebujem pomoc"):
  - Vysvetľuje princíp magického štvorca
  - Zobrazí hodnotu spoločného súčtu
- Súčet nie je zobrazený v hlavnom texte — iba v nápovede

---

## Hodnotenie — hviezdy

| Chyby v leveli | Hviezdy |
| --- | --- |
| 0 | ⭐⭐⭐ |
| 1–2 | ⭐⭐ |
| 3+ | ⭐ |

- Chyba = každá nesprávna odpoveď (pre tú istú otázku možno opakovať)
- Level sa dá znovu hrať (mapa umožňuje návrat na dokončené levely)
- Hviezdy sa ukladajú, zobrazujú sa na mape

---

## Bonusová hviezda

- Podmienka: hráč dosiahne 3 hviezdy (level bez chyby)
- Ihneď po dokončení levelu sa zobrazí bonusová otázka iného typu s časomierou **15 sekúnd**
- Časomiera je zelená; pod 5 s sa sfarbí na červenú a pulzuje
- Správna odpoveď v čase → bonusová 🌟 hviezda pripísaná k levelu
- Bonusová hviezda je zobrazená na uzle mapy ako malá animovaná 🌟
- Bonusová otázka je vždy tier 2 (ťažšia než štandardné otázky levelu)

---

## Senzorové mechaniky

| Senzor | Použitie | Fallback |
| --- | --- | --- |
| Gyroskop (`deviceorientation`, gamma os) | Naklonenie váh (`compare scale`) | Tlačidlá ⬅️ ➡️ |
| Akcelerometer (`devicemotion`) | Zatrasenie telefónom (`rozklad shake`, `peniaze`) | Tlačidlo / automaticky po 3 s |

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

Zbierajú sa automaticky, viditeľné v „Pre rodiča":

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
| `tofik-game-v1` | Postup hry (pet, mód, hviezdy, bonusy, done per level) |
| `tofik-stats-v1` | Štatistiky pokusov (posledných 200) |
| `tofik-audio-v1` | Nastavenia zvuku (mute, volume) |
