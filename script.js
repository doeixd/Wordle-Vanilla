const possibleWordsWorker = setup();

// --------------------------------------------------------
// GAME STATE:
// --------------------------------------------------------

const localStorageGameState = () => JSON.parse(localStorage.getItem('gameState'));

const defaultGameState = {
  wordle: '',
  //state can be one of: rightSpot, wrongSpot, wrongLetter, gusssed, or null
  gameBoard: Array.from({length: 30}, _ => ({letter: null, state: null})),
  pointer: 0,
  checked: [null, null, null, null, null, null],
  won: false,
};

const defaultUserState = {
  colorScheme: null,
  winHistory: [null, null, null, null, null, null],
  persist: true,
  gameHistory: [],
  stats: {
    gamesPlayed: 0,
    winPercent: 0,
    currentStreak: 0,
    maxStreak: 0,
  },
};

var State = { ...defaultGameState, ...defaultUserState };

localStorageGameState()?.persist && update(localStorageGameState())

let possibleWords;


// --------------------------------------------------------
// RUNTIME:
// --------------------------------------------------------

document.addEventListener('keydown', (e, { won } = State) => {
  if (
    won ||
    activeRow() == 6 ||
    $('stats-container').getAttribute('aria-hidden') == 'false'
  )
    return;
  if (e.key == 'Backspace') backspace();
  if (e.key == 'Enter' && isRowDone()) return enter();
  if (e.key.match(/^[a-z]|[A-Z]$/)) add(e.key.toLowerCase());
});

// Foward clicks of the "keyboard" to the above handler
$$('keyboard-row button').forEach((button) => {
  button.addEventListener('click', (e) => {
    let key;
    key = e.currentTarget?.innerText?.toLowerCase() ?? '';
    if (e.currentTarget.id == 'backspace') key = 'Backspace';
    if (e.currentTarget.id == 'enter') key = 'Enter';

    document.dispatchEvent(new KeyboardEvent('keydown', { key }));
    e.currentTarget.blur();
  });
});

function render(actions, effects = []) {
  // Ensure actions and effects are arrays
  actions = [actions].flat();
  effects = [effects].flat();

  const oldGameState = clone(State);
  const newGameState =
    actions.length &&
    actions.reduce((acc, cur) => {
      return Object.assign(clone(oldGameState), cur(clone(acc)));
    }, clone(State));
  State = newGameState;
  
  const effectsToRun = [...effects, paint, persist];
  (async () => {
    for (let effect of effectsToRun) {
      await effect(oldGameState, newGameState);
    }
  })();

  return newGameState;
}

// --------------------------------------------------------
// ACTIONS:
// --------------------------------------------------------

function add(val) {
  return render(({ checked, gameBoard, pointer }) => {
    if (!checked[rowNum() - 1] && isRowDone()) return;
    gameBoard.length = 30;
    gameBoard[pointer] = { letter: val, state: 'guessedLetter' };
    if (pointer < 30) pointer++;
    return { gameBoard, pointer };
  });
}

function backspace() {
  return render(({ pointer, gameBoard, checked }) => {
    if (pointer == 0) return;
    if (checked[rowNum(pointer - 1)]) return;
    pointer--;
    gameBoard[pointer] = { letter: null, state: null };
    return { pointer, gameBoard };
  });
}

function enter() {
  const { checked, wordle, gameBoard } = State;
  const guess = guesses(gameBoard)[activeRow({ checked })];
  if (!possibleWords.has(guess)) return badWord();
  if (guess == wordle) return won();
  if (activeRow() == 5) return lost();
  return check();
}

function getCheckedGameboard(gameState) {
  const row = Math.min(activeRow(gameState), 5);
  const validityMask = getRowValidityMask(row, gameState);
  validityMask.forEach((state, idx) => {
    let tileIdx = idx + row * 5;
    gameState.gameBoard[tileIdx].state = state;
  });
  return gameState.gameBoard;
}

function check() {
  return render((gameState) => {
    gameState.gameBoard = getCheckedGameboard(gameState);
    gameState.checked[activeRow()] = true;
    return gameState;
  }, animateSumbittedRow);
}

function setStats() {
  return render(
    ({ stats, checked, winHistory, gameHistory }) => {
      stats.gamesPlayed = gameHistory.length;
      stats.winPercent =
        Math.round(
          (winHistory.reduce((acc, cur) => acc + cur, 0) / stats.gamesPlayed || 0)
         * 100);
      
      let currentStreak = 0
      for (let game of gameHistory.reverse()) {
        if (!game.won) break
        currentStreak++
      }
      stats.currentStreak = currentStreak

      if (stats.currentStreak > stats.maxStreak)
        stats.maxStreak = stats.currentStreak;
      
        return { stats };
    },
    [paintStats, showGraph]
  );
}

function won() {
  var winningRow;
  return render(
    (gameState) => {
      let {
        checked,
        winHistory,
        gameHistory,
        won,
        wordle,
        gameBoard,
        pointer,
      } = gameState;
      gameBoard = getCheckedGameboard(gameState);
      checked[activeRow()] = true;
      winningRow = activeRow({ checked }) - 1;
      won = true;
      winHistory[winningRow]++;
      pointer++;
      gameHistory.push({ wordle, gameBoard, won, checked });
      return { winHistory, won, gameHistory, pointer, gameBoard };
    },
    [
      animateSumbittedRow,
      (oldGameState, newGameState) => {
        const randomPraise = generateWinningMessage(winningRow);
        showToast(randomPraise, 2.5, () => showStatsModal(oldGameState, newGameState));
      },
    ]
  );
}

function lost() {
  return render(
    (gameState) => {
      let { checked, wordle, gameHistory, gameBoard, won, pointer } = gameState;
      checked[5] = true;
      gameBoard = getCheckedGameboard(gameState);
      gameHistory.push({ wordle, gameBoard, won, checked, pointer });
      return { checked, gameHistory, gameBoard };
    },
    [
      animateSumbittedRow,
      ({ wordle }) => showToast(wordle, 2.5, showStatsModal, true),
    ]
  );
}

function newGame() {
  return render(
    ({ wordle }) => {
      wordle = possibleWordsWorker.postMessage('newWordle');
      return {
        ...defaultGameState,
        wordle: wordle,
      };
    },
    [
      () => {
        closeStatsModal();
        [...$$('keyboard-row button')].forEach((key) =>
          key.setAttribute('style', '')
        );
        $('toast-container').replaceChildren()
      }
    ]
  );
}

function update(newState) {
  return render(
    () => newState
  )
}

function toggleColorScheme () {
  return render (({colorScheme}) => {
    colorScheme = colorScheme == 'dark' ? 'light' : 'dark'
    return {colorScheme}
  })
}

// --------------------------------------------------------
// EFFECTFUL:
// --------------------------------------------------------

async function paint(oldGameState, newGameState) {
  if (newGameState.colorScheme) {
    if (newGameState.colorScheme == 'light') document.documentElement.classList.remove('dark')
    if (newGameState.colorScheme == 'dark') document.documentElement.classList.remove('light')
    document.documentElement.classList.add(newGameState.colorScheme)
    // $('html').classList.add('transistion')
  }

  newGameState.gameBoard.forEach(({ letter, state }, idx) => {
    if (letter) {
      const letterEl = $('#' + letter);
      letterEl.style = {};

      state == 'wrongLetter' && letterEl.classList.add('wrongLetter');
      state == 'wrongSpot' && letterEl.classList.add('wrongSpot');
      state == 'rightSpot' && letterEl.classList.add('rightSpot');
    }
    // Dont bother repainting tiles
    const { letter: oldLetter, state: oldState } = oldGameState.gameBoard[idx];
    if (oldLetter == letter && state == oldState) return;

    const tiles = getTiles();
    tiles[idx].innerText = letter ?? '';
    tiles[idx].classList = '';
    tiles[idx].classList.add(state);
    tiles[idx].style = {};

    if (newGameState.pointer == 0)
      $$('keyboard-row button').forEach((key) => {
        key.classList = '';
      });
  });
  
  if (newGameState.pointer == 30 && !newGameState.won && !$('tost-container').children.length)
    showToast(newGameState.wordle, null, null, true)
}

async function paintStats(_, { stats, winHistory }) {
  Object.entries(stats).forEach(([stat, value]) => {
    $(`#${stat}`).innerText = value;
  });
  const mostCommonRow = winHistory.reduce(
    (acc, cur) => (cur > acc ? cur : acc),
    0
  );

  const rowHeights =
    winHistory.map((row) => {
      const res = Math.floor((+row / mostCommonRow) * 100);
      return res;
    }) || 0;

  const bars = [...$$('bar-text')];
  bars?.forEach((bar, idx) => {
    bar.innerText = winHistory[idx];
    (bar?.parentElement.animate(
      [
        { height: '0%' },
        {
          height: `${rowHeights?.[idx] ?? 0}%`,
          backgroundColor: `var(--barRank-${Math.round((rowHeights?.[idx] ?? 0) / 20)})`,
        },
      ],
      { duration: 350, easing: 'ease-in-out', delay: 170 * idx + 550 }
    )).onfinish = () => {
      bar.parentElement.style.height = `${rowHeights?.[idx] ?? 0}%`;
      bar.parentElement.style.backgroundColor = `var(--barRank-${Math.round(
        (rowHeights?.[idx] ?? 0) / 20
      )})`;
    };
  });
}

async function animateSumbittedRow(oldState, newState) {
  if (activeRow(oldState) == activeRow(newState) && !newState.won) return;
  const sumbittedRow = getRowEls(activeRow(oldState));
  let done = await new Promise((resolve, reject) => {
    sumbittedRow.forEach((tile, idx) => {
      tile.classList.remove('guessedLetter');
      const styles = getValidityStyles(activeRow(oldState), idx, oldState);
      tile.animate(
        [
          { transform: 'rotate3d(50, 0, 0, -180deg)', ...styles },
          { transform: 'rotate3d(0,0,0, 180deg)', ...styles },
        ],
        {
          duration: 600,
          delay: idx * 300 + 50,
          easing: 'ease-in-out',
        }
      ).onfinish = async (_) => {
        setStylesOnElement(styles, tile);
        if (idx == 4) resolve(true);
        if (!idx && newState.won) await animateWinningRow(null, State);
      };
    });
  });
}

async function animateWinningRow(_, { gameState }) {
  getRowEls(activeRow(gameState)).forEach((tile, idx) => {
    tile.animate(
      [
        { transform: 'translate(0,-10px)' },
        { transform: 'translate(0, -35px)' },
        { transform: 'translate(0, -25px)' },
        { transform: 'translate(0, 7px)' },
        { transform: 'translate(0,-8px)' },
        { transform: 'translate(0,0px)' },
      ],
      {
        duration: 450,
        delay: idx * 100 + 750,
        easing: 'ease-out',
      }
    );
  });
}

async function showGraph(_, { winHistory }) {
  const gamesWon = winHistory.reduce((acc, cur) => acc + cur, 0);
  if (gamesWon == 0) return;
  $('graph').style.display = 'flex';
  $('stats h3').style.display = 'block';
  $('no-history').style.display = 'none';
}

async function persist(_, newGameState) {
  if (!newGameState.persist) return;
  localStorage.clear();
  localStorage.setItem('gameState', JSON.stringify(newGameState));
}

function badWord() {
  showToast('Not In Word List');
  const row = getRowEls(activeRow(), false);
  row.animate(
    [
      { transform: 'translate(10px)' },
      { transform: 'translate(-10px)' },
      { transform: 'translate(5px)' },
      { transform: 'translate(-5px)' },
      { transform: 'translate(2px)' },
    ],
    {
      duration: 250,
      easing: 'ease-out',
    }
  );
}

function showToast(msg, time = 1, cb = () => { }, persist = false, style = '') {
  const toastContainer = $('toast-container');

  const toastTemplate = html(`<toast style=${style}>${msg.toUpperCase()}</toast>`);
  toastContainer.prepend(toastTemplate);
  const toast = toastContainer.firstChild;

  setTimeout(function() {
    if (!persist) 
      toast.animate([{ opacity: '1' }, { opacity: '0' }], 400).onfinish = () => {
        toastContainer.removeChild(toast);
      };
    cb();
  }, time * 1000);
}

function getValidityStyles(rowNum = activeRow(), idx, gameState = State) {
  const stylesMask = getRowValidityMask(rowNum, gameState);
  return stylesMask.map((style, idx) => {
    const styles = {
      borderColor: 'transparent',
      color: `var(--submittedTextColor)`,
      backgroundColor: 'var(--wrongLetterColor',
    };
    if (style == 'rightSpot') styles.backgroundColor = 'var(--rightSpotColor)';
    if (style == 'wrongSpot') styles.backgroundColor = 'var(--wrongSpotColor)';
    return styles;
  })[idx];
}

function setStylesOnElement(styles, element) {
  Object.assign(element.style, styles);
}

function showStatsModal() {
  setStats();
  $('stats-container').style.display = 'flex';
  $('stats-container').setAttribute('aria-hidden', 'false');
  $('stats').classList = '';
  $('stats').classList.add('enter');
  $('h1').classList.add('blur');
  $('#game').classList.add('blur');
  $('#game').setAttribute('aria-hidden', 'true');
}

function closeStatsModal(e) {
  $('h1').classList.remove('blur');
  $('#game').classList.remove('blur');
  $('#game').setAttribute('aria-hidden', 'false');
  $$('[id^="bar"]').forEach((bar) => {bar.style.height = 0; bar.style.backgroundColor = 'var(--winHistoryBarColor)'});
  $('stats-container').setAttribute('aria-hidden', 'true');
  $('stats').classList = '';
  $('stats').animate(
    { transform: 'translate(0, -200px)', opacity: 0 },
    { duration: 200, easing: 'ease-in-out' }
  ).onfinish = () => {
    $('stats-container').style.display = 'none';
  };
}

function share() {
  const share = getEmojiGameBoard();
  navigator.clipboard.writeText(share);
  showToast('Copied to Clipboard', 2, null, null, 'z-index:4');
}

function getRowValidityMask(rowNumber = activeRow(), { gameBoard, wordle }) {
  let guess = guesses(gameBoard);
  guess = guess[rowNumber];
  // The following logic is necessary because of how the OG wordle handles duplicate letters, see "Note on Rules" in readme
  let foil = wordle;
  return guess
    .split('')
    .map((letter, idx) => {
      if (wordle[idx] == letter) {
        foil = replaceAt(foil, idx);
        return 'rightSpot';
      }
      return letter;
    })
    .map((letter, idx) => {
      if (foil.match(guess[idx]) && letter.length == 1) {
        foil = replaceAt(foil, foil.indexOf(guess[idx]));
        return 'wrongSpot';
      }
      return letter;
    })
    .map((letter, idx, arr) => {
      if (!~foil.indexOf(guess[idx]) && letter.length == 1)
        return 'wrongLetter';
      return letter;
    });
}

// --------------------------------------------------------
// UTILITY FUNCTIONS:
// --------------------------------------------------------

function html(html) {
  var template = document.createElement('template');
  html = html.trim();
  template.innerHTML = html;
  return template.content.firstChild;
}

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

function replaceAt(str, idx) {
  return str.slice(0, idx) + '#' + str.slice(idx + 1);
}

function getTiles() {
  const tiles = [];
  for (let i = 0; i < 6; i++) {
    tiles.push(...($(`#row-${i}`)?.children || []));
  }
  return tiles;
}

function pointer({ gameBoard } = State) {
  return gameBoard.reduce((acc, cur, idx, arr) => {
    if ((!cur?.letter && !acc) || idx == arr.length - 1) return idx;
    return acc;
  }, 0);
}

function rowNum(point = State.pointer) {
  if (point < 0) point = 0;
  return Math.floor(point / 5);
}

function activeRow({ checked } = State) {
  return checked.filter((i) => i).length;
}

function isRowDone({ checked, pointer } = State) {
  return !checked[rowNum() - 1] && rowNum(pointer - 1) < rowNum();
}

function guesses(gameBoard) {
  return gameBoard.reduce((acc, cur, idx, arr) => {
    let groupNum = Math.floor(idx / 5);
    acc[groupNum] = (acc?.[groupNum] ?? '') + (cur.letter || '');
    return acc;
  }, []);
}

function getRowEls(rowNumber = activeRow(), kids = true) {
  rowNumber = rowNumber == 6 ? 5 : rowNumber;
  const row = $(`#row-${rowNumber}`);
  if (!kids) return row;
  return [...row?.children] ?? [];
}

function collect(arr) {
  return arr.reduce((acc, cur) => acc + cur.innerText.toLowerCase(), '');
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

function randomIdx(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateWinningMessage(winningRow) {
  const generalPraises = [
    'You Won!',
    'Great Job!',
    'You Rock!',
    'Pure Genius!',
    'Wonderful',
    'Beautiful!',
    'Gold Star!',
    'Nice!',
    'Very Cool!',
    'You got it!',
    'Keep it up!',
    'wow!',
    'incredible!',
    'cheers!',
    'Magnificent!',
    'Impressive!',
    'Splendid!',
    'Way To Go!',
  ];
  const lastLinePraises = [
    'phew!',
    'close call!',
    'I was worried about you there!',
  ];
  const firstLinePraises = [
    'impossible!',
    "I can't believe it!",
    "How'd you know?!",
    'genius!',
    'Cheater!',
  ];

  return winningRow == 0
    ? randomIdx(firstLinePraises)
    : winningRow == 5
      ? randomIdx(lastLinePraises)
      : randomIdx(generalPraises);
}

function getEmojiGameBoard() {
  return State.gameBoard.reduce((acc, cur, idx) => {
    const newLine = (idx + 1) % 5 == 0 ? '\n' : '';
    const bgColor = getRowValidityMask(rowNum(idx), State)[idx % 5];
    if (bgColor == 'rightSpot') return acc + '🟩' + newLine;
    if (bgColor == 'wrongSpot') return acc + '🟨' + newLine;
    return acc + '⬜' + newLine;
  }, '');
}

function setup() {
  // getColorScheme
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (e) => {
      update({...State, colorScheme: (e.matches ? 'dark' : 'light')})
    });

  const possibleWordsWorker = new Worker('possibleWords.js');
  possibleWordsWorker.postMessage('');
  possibleWordsWorker.onmessage = function(e) {
    if (typeof e.data !== 'object') return;
    if (!State.wordle) State.wordle = e.data.randomWord;
    possibleWords = e.data.possibleWordsMap;
  };
  
  document.addEventListener('touchmove', e => {
    e.preventDefault()
    e.stopImmediatePropagation()
  
    window.scroll({
      top: 0, 
      left: 0, 
      behavior: 'smooth' 
    })

  }, {passive: false})
  
  return possibleWordsWorker;
}


