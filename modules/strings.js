// strings.js — Slovak UI text (sk-SK)
// All user-facing strings live here. To add a language, copy this file,
// translate all values, and swap the import in app.js.
//
// Template strings with variables are arrow functions: (param) => `text ${param}`.

export const S = {

  // ——— Pet default names (keyed by pet id) ———
  petNames: {
    fox:      'Tofík',
    bear:     'Maco',
    rabbit:   'Hopko',
    owl:      'Sovka',
    hedgehog: 'Ferko',
    cat:      'Mica',
  },

  // ——— Map level names (index = level id) ———
  levelNames: ['Lúka', 'Sad', 'Vodopád', 'Jazierko', 'Jaskyňa', 'Vrchol', 'Hviezdy'],

  // ——— Skill display names (keyed by type) ———
  skillNames: {
    count:       'Počítanie',
    add5:        'Sčítanie do 5',
    rozklad:     'Rozklad čísel',
    compare:     'Porovnávanie',
    add10:       'Sčítanie do 10',
    sequence:    'Postupnosti',
    addsub20:    '+ a − do 20',
    rozklad20:   'Rozklad do 20',
    seqstep:     'Postupnosti s krokom',
    peniaze:     'Počítanie peňazí',
    wordproblem: 'Slovné úlohy',
    magic:       'Magický štvorec',
  },

  // ——— Emoji plural descriptors for count questions ———
  emojiNames: {
    '🍎': 'jabĺčok', '🌻': 'kvietkov', '🐝': 'včielok', '🍓': 'jahôd',
    '⭐': 'hviezdičiek', '🦋': 'motýľov', '🍄': 'hríbov', '🌸': 'kvietkov',
    '💧': 'kvapiek', '🌟': 'hviezdičiek', '💎': 'klenotov',
    '🍒': 'čerešní', '🍬': 'cukríkov',
  },
  emojiNameDefault: 'vecí',

  // ——— Question prompts ———
  prompts: {
    countQ:        (name) => `Koľko ${name} vidíš?`,
    countLabel:    'Spočítaj',
    addResult:     'Koľko spolu?',
    add10Result:   'Spočítaj:',
    addMissing:    'Doplň chýbajúce číslo:',
    subResult:     'Odpočítaj:',
    compareTap:    'Kde je viac?',
    compareScale:  'Nakloň telefón k ťažšej strane!',
    missingNum:    'Aké číslo chýba?',
    magicLabel:    'Magický štvorec',
    magicPrompt:   'Aké číslo chýba v magickom štvorci?',
    rozkladTree:   (total) => `Koľko chýba do ${total}?`,
    rozkladShake:  (total) => `Zatras telefónom a rozhoď ${total} fazuľ!`,
    peniaze:       'Koľko eur máš v prasiatku?',
  },

  // ——— Word problems bank (text only; number generators stay in app.js) ———
  wordProblems: [
    { emoji: '🍪', text: (a, b, e) => `Tomáš má ${a} ${e} keksíkov. Dostal ešte ${b} ${e}. Koľko má spolu?`,           op: '+' },
    { emoji: '✏️', text: (a, b, e) => `Jana má ${a} ${e} ceruziek. Dala ${b} ${e} kamarátke. Koľko jej ostalo?`,        op: '-' },
    { emoji: '🍏', text: (a, b, e) => `V košíku je ${a} ${e} jabĺk. Pribudlo ${b} ${e}. Koľko ich je spolu?`,           op: '+' },
    { emoji: '🐦', text: (a, b, e) => `Na strome sedelo ${a} ${e} vtákov. Odletelo ${b} ${e}. Koľko zostalo?`,          op: '-' },
    { emoji: '🧁', text: (a, b, e) => `Mama upiekla ${a} ${e} buchiet. Ocko zjedol ${b} ${e}. Koľko buchiet ostalo?`,   op: '-' },
    { emoji: '🔴', text: (a, b, e) => `Vo fľaši bolo ${a} ${e} guličiek. Pridal som ${b} ${e}. Koľko ich je?`,          op: '+' },
    { emoji: '🏷️', text: (a, b, e) => `Peter má ${a} ${e} nálepiek. Zdenko má o ${b} ${e} menej. Koľko má Zdenko?`,     op: '-' },
    { emoji: '🌰', text: (a, b, e) => `Anička nazbierala ${a} ${e} gaštanov. Nazbierala ešte ${b} ${e}. Koľko ich má?`, op: '+' },
  ],

  // ——— Feedback messages ———
  feedback: {
    correct:      ['Super!', 'Skvelé!', 'Výborne!', 'Wow!', 'Bravo!'],
    correctShort: ['Super!', 'Skvelé!', 'Výborne!', 'Bravo!'],
    wrong:        'Skús ešte raz!',
    bonusTimeout: 'Nevadí, skúsiš to neskôr!',
    scaleGood:    'Skvelé, drž to!',
    scaleWrong:   'Opačná strana!',
    scaleSuccess: 'Výborne!',
  },

  // ——— Bonus prompt ———
  bonus: {
    label:    '🌟 Bonus!',
    question: 'Zvládneš ťažšiu otázku?',
    accept:   'Áno, skúsim! 💪',
    skip:     'Preskočiť',
    timeout:  '⏰ Čas vypršal!',
  },

  // ——— Result screen ———
  result: {
    stars3:         'Perfektné!',
    stars2:         'Skvelá práca!',
    stars1:         'Dobre!',
    bonusTitle:     '🌟 Fantastické!',
    bonusSpeeches:  (name) => [`${name} je nadšený!`, 'Bonus zvládnutý!', 'Si hviezdičkový matematik!'],
    normalSpeeches: (name) => [`Si super matematik!`, `${name} sa teší!`, 'Ideme ďalej!', 'Skvelý postup!', `${name} ďakuje!`, 'O krok bližšie k hviezdam!'],
  },

  // ——— Welcome / navigation ———
  welcome: {
    title:        (name) => `${name} a<br>cesta ku hviezdam`,
    docTitle:     (name) => `${name} a cesta ku hviezdam`,
    speech:       (name) => `Ahoj, som ${name}. Poď so mnou na cestu ku hviezdam!`,
    speechReturn: 'Pokračujme na ceste ku hviezdam!',
    continueBtn:  'Pokračovať →',
  },

  // ——— Win screen ———
  win: {
    speech: 'Ďakujem ti, kamarát! Zahráme si znova?',
  },

  // ——— Bean scatter (rozklad shake) ———
  beans: {
    shake:    'Zatras a rozhoď fazule do košíkov!',
    falling:  'Padajú...',
    manualBtn:'📱 Alebo kliknite tu',
    sideLeft: 'ľavom',
    sideRight:'pravom',
    question: (side, count) => `V <b>${side}</b> košíku je <b>${count}</b>. Koľko je v druhom?`,
  },

  // ——— Piggy bank (peniaze) ———
  peniaze: {
    click: 'Klikni na prasiatko! 👆',
    count: 'Spočítaj všetky peniaze!',
  },

  // ——— Help panels ———
  help: {
    show:      '💡 Zobraziť nápovedu',
    hide:      '💡 Skryť nápovedu',
    needHelp:  '💡 Potrebujem pomoc',
    magicRule: 'V magickom štvorci platí: súčet čísel v každom <b>riadku</b> aj každom <b>stĺpci</b> je vždy rovnaký.',
    magicSum:  (n) => `Súčet = <b>${n}</b>`,
  },

  // ——— Difficulty badge (tier 1–4) ———
  tier: {
    names:   { 1: 'Najľahšie', 2: 'Základné', 3: 'Ťažšie', 4: 'Najťažšie' },
    tooltip: (n) => `Úroveň náročnosti: <b>${n} zo 4</b> (${S.tier.names[n]}).<br>`
      + 'Otázky sa prispôsobujú — keď sa ti darí, dostaneš ťažšie. '
      + 'Posledná otázka v leveli a bonusová otázka sú vždy najťažšie.',
  },

  // ——— Parent dashboard ———
  parent: {
    audio:              'Zvuky',
    audioOff:           '🔇 Vypnuté',
    audioOn:            '🔊 Zapnuté',
    volume:             'Hlasitosť',
    storageChecking:    'Kontrolujem ochranu dát…',
    storageUnavailable: 'Ochrana úložiska nie je dostupná v tomto prehliadači.',
    storageProtected:   'Dáta sú chránené — prehliadač ich nevymaže bez tvojho súhlasu.',
    storageUnprotected: 'Dáta nie sú chránené. Prehliadač ich môže vymazať pri plnom úložisku.',
    storageBtn:         'Chrániť dáta',
    noStats:            'Zatiaľ tu nie sú žiadne údaje.<br>Štatistiky sa začnú zbierať, keď dieťa odpovie na prvé otázky.',
    statTotal:          'otázok celkovo',
    statAccuracy:       'úspešnosť na prvý pokus',
    statTime:           'celkový čas hrania',
    statAvgTime:        'priemerne na otázku',
    statStreak:         'dní v rade',
    statMistakes:       'chýb spolu',
    bySkill:            'Podľa zručnosti',
    recentMistakes:     'Posledné chyby',
    noMistakes:         'Žiadne chyby — paráda! 🎉',
    noSkillData:        'Nič tu zatiaľ nie je.',
    skillMeta:          (count, avg, mistakes) => `${count} otázok · ⌀ ${avg} s · ${mistakes} chýb`,
    restartBtn:         '↺ Začať hru odznova',
    resetStatsBtn:      'Vymazať štatistiky',
    updateCheck:        '🔄 Skontrolovať aktualizáciu',
    updateChecking:     'Kontrolujem…',
    updateCurrent:      '✓ Aplikácia je aktuálna',
    privacy:            'Štatistiky sa ukladajú len v tomto zariadení. Nikam sa neodosielajú.',
  },

  // ——— Difficulty mode labels ———
  modeLabels: {
    do10:      'Do 10',
    do20:      'Do 20',
    pokrocile: 'Pokročilé',
  },

  // ——— Confirmation dialogs (modal message bodies; the question is the modal title) ———
  confirm: {
    restart:          'Stratíš všetok pokrok.',
    resetStats:       'Vymažú sa všetky štatistiky. Pokrok v hre ostane zachovaný.',
    changeDifficulty: 'Stratíš celý herný postup.',
  },

  // ——— Reusable modal dialog (titles + buttons) ———
  modal: {
    yes:             'Áno',
    no:              'Zrušiť',
    changeTitle:     'Zmeniť obtiažnosť?',
    restartTitle:    'Začať odznova?',
    resetStatsTitle: 'Vymazať štatistiky?',
  },

  // ——— Time formatting ———
  time: {
    justNow:  'pred chvíľou',
    yesterday:'včera',
    minutes:  (m) => `${m} min`,
    hours:    (h) => `${h} h`,
    days:     (d) => `${d} dní`,
    seconds:  (s) => `${s} s`,
    minSec:   (m, s) => `${m} m ${s} s`,
    minOnly:  (m) => `${m} min`,
    hourMin:  (h, m) => `${h} h ${m} min`,
  },

  // ——— Update banner ———
  update: {
    available: 'Nová verzia je k dispozícii 🎉',
    btn:       'Obnoviť',
  },
};
