const possibleWordsWorker = setup()


// --------------------------------------------------------
// GAME STATE: 
// --------------------------------------------------------

const localStorageGameState = () => localStorage.getItem('gameState')

const defaultGameState = {
  wordle: null,
  // TODO: I should change this to {letter, state}. It would clean things up a bit
  // State can be one of: rightSpot, wrongSpot, wrongLetter, gusssed, or null
  gameBoard:  [...Array(30).keys()].map((i) => ({letter: null, state: null})),
  pointer: 0,
  checked: [null,null,null,null,null,null],
  won: false,
}

const defaultUserState = {
  colorScheme: null,
  winHistory: [null,null,null,null,null,null],
  persist: true,
  gameHistory: [],
  stats: {
    gamesPlayed: 0,
    winPercent: 0,
    currentStreak: 0,
    maxStreak: 0    
  }
}

var State = 
  localStorageGameState()?.persist 
    ? localStorageGameState
    : { ...defaultGameState, ...defaultUserState }


let possibleWords;


// --------------------------------------------------------
// RUNTIME:
// --------------------------------------------------------

document.addEventListener('keydown', (e, {pointer, gameBoard, wordle, won} = State) => {
  if (won || activeRow() == 6 || $('stats-container').getAttribute('aria-hidden') == 'false') return
  if (e.key == 'Backspace') backspace();
  if (e.key == 'Enter' && isRowDone()) return enter();
  if (e.key.match(/^[a-z]|[A-Z]$/)) add(e.key.toLowerCase());
});

$$('keyboard-row button').forEach(button => {
  button.addEventListener('click', (e)=> {
    let key;
    key = e.currentTarget?.innerText?.toLowerCase() ?? ''
    if(e.currentTarget.id == 'backspace') key = 'Backspace'
    if(e.currentTarget.id == 'enter') key = 'Enter'

    document.dispatchEvent(new KeyboardEvent('keydown', {key}))
    e.currentTarget.blur()
  })
})

function render(actions, effects = []) {
  actions = [actions].flat()
  effects = [effects].flat()
  const oldGameState = clone(State)

  const newGameState = actions.length && actions.reduce(
    (acc,cur) => {
      return Object.assign(clone(oldGameState), cur(clone(acc)))
    }, clone(State)
  )
  const effectsToRun = [...effects, paint, persist]

  // let effectWithCallback = effect => cb => { return (effect(oldGameState, newGameState), cb?.()) }
  // const effectsWithCallbacks = effectsToRun.map(f => effectWithCallback(f))
  // pipe(...effectsWithCallbacks)(_=>_)

  // console.log({newGameState})
  ;(async () => {
    for (let effect of effectsToRun) {
      await effect(oldGameState, newGameState)
    }
  })()

  // the effect list takes the old state and the new state and an effect callback
  // I need to turn a list of effects in to effect1(o,n,effect2(o,n,effect3()))
  // I need to create a function that calls the last effect with the given state, then returns a function that does the same the next to last effect with the given state.
  // for each function I need to create a function that calls the current effect then calls the next effect 
  // let p = n => effect(oldGameState, newGameState, n)

  // effectsToRun.forEach(effect => {
  //   let res = effect(oldGameState, newGameState, )
  //   const callReturnedEffect = (arg = res) => typeof arg == 'function' ? arg(oldGameState, newGameState) : 'done'
  //   callReturnedEffect?.(res)
  // })

  State = newGameState
  return State
}

// --------------------------------------------------------
// ACTIONS:
// --------------------------------------------------------

function add (val) {
  return render(
    ({checked, gameBoard, pointer}) => {
      if(!checked[rowNum() -1] && isRowDone()) return
      gameBoard.length = 30
      gameBoard[pointer] = {letter: val, state: 'guessedLetter'}
      if(pointer < 30) pointer++;
      return {gameBoard, pointer}
    }
  )
}

function backspace () {
  return render(
    ({pointer, gameBoard, checked}) => {
      if(pointer == 0) return
      if(checked[rowNum(pointer-1)]) return
      pointer--
      gameBoard[pointer] = {letter: null, state: null}
      return {pointer, gameBoard}
    }
  )
}

function enter() {
  // return render(
    // ({checked, wordle,gameBoard}) => {
      const {checked, wordle,gameBoard} = State 
      const guess = guesses(gameBoard)[activeRow({checked})]
      if (!possibleWords.has(guess)) return badWord()
      if (guess == wordle) return won()
      if (activeRow() == 5) return lost()
      return check()
    // }
  // )
}

function check () {
  return render (
    (gameState) => {
      const row = activeRow(gameState)
      console.log({row})
      const validityMask = getRowValidityMask(activeRow(gameState),gameState)
      console.log({validityMask})
      validityMask.forEach((state, idx) => {
        let tileIdx = idx + (activeRow()*5)
        console.log(tileIdx)
        gameState.gameBoard[tileIdx].state = state
      })
      console.log({gameState})
      gameState.checked[activeRow()] = true;
      return gameState
    }, animateSumbittedRow
  )
}

function setStats() {
  return render(
    ({stats, checked, winHistory, gameHistory}) => {
      stats.gamesPlayed = gameHistory.length
      stats.winPercent = Math.round((winHistory.reduce((acc, cur) => acc+cur,0) / stats.gamesPlayed) || 0 ) * 100
      stats.currentStreak = gameHistory.reduce((acc, cur) => {
        return !cur.won && acc > 0 ? acc : acc+1
      },0)
      if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak
      return { stats }
    }, [paintStats, showGraph]
  )
}

function won () {
  var winningRow;
  return render(
    (gameState) => {
      let {checked, winHistory, gameHistory, won, wordle, gameBoard, pointer} = gameState
      checked[activeRow()] = true
      winningRow = activeRow({checked})
      won = true;
      winHistory[winningRow]++;
      pointer++
      gameHistory.push({wordle, gameBoard, won, checked})
      return {winHistory, won, gameHistory, pointer}
    }, [animateSumbittedRow, (oldGameState) => {
      const randomPriaise = generateWinningMessage(winningRow)
      showToast(randomPriaise, 2.5,showStatsModal) 
    }]
  )
}

function lost() {
  return render(
    (gameState) => {
      let{checked, wordle, gameHistory, gameBoard, won, pointer } = gameState
      checked[5] = true
      gameHistory.push({wordle, gameBoard, won, checked, pointer})
      return {checked, gameHistory}
    }, [animateSumbittedRow, ({wordle}) => showToast(wordle, 2.5, showStatsModal)]
  )
}

function newGame () {
  return render(
    ({wordle}) => {
      wordle = possibleWordsWorker.postMessage('newWordle')
      closeStatsModal()
      return {
        ...defaultGameState,
        wordle: wordle
      }
    }, [() => {
        [...$$('keyboard-row button')].forEach(key => key.setAttribute('style',''))
    }, ]
  )
}


// --------------------------------------------------------
// EFFECTFUL:
// --------------------------------------------------------

async function paint(oldGameState, newGameState) {
  let tiles = getTiles()
  // if pointer is different. repaint

  console.log('paint',{newGameState})
  newGameState.gameBoard.forEach(({letter, state}, idx) => {
    //if (oldGameState.checked[rowNum(idx)] && activeRow(newGameState) > oldGameState.checked[rowNum(idx)]) return
    tiles[idx].innerText = letter ?? '';
    tiles[idx].classList = ''
    tiles[idx].classList.add(state)
    tiles[idx].style = {}
  })
}

async function paintStats (_, {stats, winHistory}) {
  Object.entries(stats).forEach(([stat, value]) => {
    $(`#${stat}`).innerText = value
  })
  const mostCommonRow = winHistory.reduce((acc, cur) => cur > acc ? cur : acc, 0)
  
  const rowHeights = winHistory.map(row => {
    const res = Math.floor((+row)/mostCommonRow * 100)
    // console.log({row}, {mostCommonRow}, (+row)/mostCommonRow)
    return res
  }) 
  const bars = [...$$('bar-text')]
  bars.forEach((bar, idx) => {
    bar.innerText = winHistory[idx]
    bar.parentElement.style.height = `${rowHeights[idx]}%`
  })
}


async function animateSumbittedRow (oldState, newState) {
  // console.log({oldrow: activeRow(oldState), newRow: activeRow(newState)})
  // console.log({oldState},{newState})
  console.log('animateSumbittedRow')
  if(activeRow(oldState) == activeRow(newState) && !newState.won) return
  const sumbittedRow  = getRowEls(activeRow(oldState))
  let done = await (new Promise((resolve, reject) => {
    sumbittedRow.forEach((tile, idx) => {
      tile.classList.remove('guessedLetter')
      const letter = tile?.innerText.toLowerCase() ?? ''
      const guess = collect(getRowEls());
      const styles = getValidityStyles(activeRow(oldState),idx,oldState);
      // console.log({styles})
      ;(tile.animate([
        {transform: 'rotate3d(50, 0, 0, -180deg)',...styles},
        {transform: 'rotate3d(0,0,0, 180deg)', ...styles}
      ],{
        duration: 600,
        delay: (idx *300) + 50,
        easing: 'ease-in-out',
      })).onfinish = async _ => {
        setStylesOnElement(styles,tile)
        setStylesOnElement(styles, $('#'+ letter))
        if(idx == 4) resolve(true)
        if(!idx && newState.won) await animateWinningRow(null,State)
      }
    })
  }))
}

async function animateWinningRow (_,{gameState}) {
  getRowEls(activeRow(gameState)).forEach((tile, idx) => {
    ;(tile.animate([
      {transform: 'translate(0,-8px)'},
      {transform: 'translate(0, -35px)'},
      {transform: 'translate(0, -25px)'},
      {transform: 'translate(0, 8px)'},
      {transform: 'translate(0,-9px)'},
      {transform: 'translate(0,0px)'}
    ],{
      duration: 450,
      delay: (idx * 100) + 650,
      easing: 'ease-out',
      // HACK: Increasing the pointer will force the style function to paint the winning row. 
      // Because the style function applies permanant styles to the row before the active row.
      // This cant be done in the win function because the row will be painted before the aimation.
    }))
    .onfinish = () => State.pointer++
  })
}


function style (el, letter, idx, {checked, pointer, wordle, gameBoard, won}, oldState) {
  el.classList.remove('guessedLetter')

  // if(rowNum(pointer -1) > rowNum(idx)) {
  const curRow = rowNum(idx)  
  // console.log(checked[curRow], oldState.checked[curRow], 'ROES CHE', )
  if(checked[curRow] == oldState.checked[curRow] && oldState.checked[curRow]){
    const tiles = getTiles()
    const stylesMask = getRowValidityMask(rowNum(idx), {gameBoard, wordle})
    return stylesMask.forEach((style, letterIdx) => {
      tiles[((letterIdx) + (rowNum(idx)) * 5)].classList.add(style)
    })
  }

  const isActiveRow  = rowNum(idx) == activeRow()
  if(isActiveRow){
    el.innerText 
      ? el.classList.add('guessedLetter')
      : el.classList.remove('guessedLetter')
  }

  if(idx === pointer) el.classList.remove('drop-in')
  if(idx === pointer -1) el.classList.add('drop-in')

  el.setAttribute('style', '')
}


async function showGraph (_,{winHistory}) {
  const gamesWon = winHistory.reduce((acc, cur) => acc+cur, 0)
  if(gamesWon == 0) return
  $('graph').style.display = 'flex'
  $('stats h3').style.display = 'block'
  $('no-history').style.display = 'none'
}

async function persist(_,newGameState) {
  if(!newGameState.persist) return
  localStorage.clear()
  localStorage.setItem('gameState', JSON.stringify(newGameState))
}

function badWord() {
  showToast('Not In Word List')
  const row = getRowEls(activeRow(),false)
  row.animate([
    {transform: 'translate(10px)'},
    {transform: 'translate(-10px)'},     
    {transform: 'translate(5px)'},
    {transform: 'translate(-5px)'},
    {transform: 'translate(2px)'},
  ], {
    duration: 250,
    easing: 'ease-out'
  } )
}

function showToast(msg, time = 1, cb = () => {}) {
  const toastContainer = $('toast-container')
  
  const toastTemplate = html(`<toast>${msg.toUpperCase()}</toast>`)
  toastContainer.prepend(toastTemplate)
  const toast = toastContainer.firstChild

  setTimeout(function () {
    toast.animate([{opacity: '1'},{opacity: '0'}], 400).onfinish = () => {
      toastContainer.removeChild(toast)
    }
    cb()
  }, time * 1000)
}

// HACK: looping through the row twice to calulate the styles for each letter isnt ideal. 
// Ideally I should change the base datastrucure and add correctness state to 
// gameBoard/gameBoardCorrectnessStateMask. That way I don't have to derive it each time. 
// I'll do that later.
function getValidityStyles(rowNum = activeRow(), idx, gameState = State) {
  const stylesMask = getRowValidityMask(rowNum, gameState)
  return stylesMask.map((style, idx) => {
    const styles = {borderColor: 'transparent', color: `var(--submittedTextColor)`, backgroundColor: 'var(--wrongLetterColor'}
    if(style == 'rightSpot') styles.backgroundColor = 'var(--rightSpotColor)'
    if(style == 'wrongSpot') styles.backgroundColor = 'var(--wrongSpotColor)'
    return styles
  })[idx]
}

function setStylesOnElement (styles, element) {
  Object.assign(element.style, styles);
}

function showStatsModal () {
  setStats()
  $('stats-container').style.display = 'flex'
  $('stats-container').setAttribute('aria-hidden', 'false')
  $('stats').classList = ''
  $('stats').classList.add('enter')
  $('h1').classList.add('blur')
  $('#game').classList.add('blur')
  $('#game').setAttribute('aria-hidden', 'true')
}

function closeStatsModal(e) {
  $('h1').classList.remove('blur')
  $('#game').classList.remove('blur')
  $('#game').setAttribute('aria-hidden', 'false')
  $('stats-container').setAttribute('aria-hidden', 'true')
  $('stats').classList = ''
  $('stats')
  .animate({transform: 'translate(0, -200px)', opacity: 0}, {duration: 200, easing: 'ease-in-out'})
    .onfinish = () => {
      $('stats-container').style.display = 'none'
  }
}

function share () {
  const share = getEmojiGameBoard()
  // console.log({share})
  navigator.clipboard.writeText(share)
  showToast('Copied to Clipboard', 2)
}

function getRowValidityMask (rowNumber = activeRow(), {gameBoard, wordle}) {
  const guess = guesses(gameBoard)[rowNumber]
  let foil = wordle
  return guess.split('')      
  .map((letter, idx) => {
    if(wordle[idx] == letter) {
      foil = replaceAt(foil, idx)
      return 'rightSpot'
     }
    return letter
  })
  .map((letter, idx) => {
    if(foil.match(guess[idx]) && letter.length == 1) {
      foil = replaceAt(foil, foil.indexOf(guess[idx]))
      return 'wrongSpot'
    } 
    return letter
  })
  .map((letter, idx, arr) => {
    if(!~foil.indexOf(guess[idx]) && letter.length == 1) return 'wrongLetter'
    return letter
  })
}

// --------------------------------------------------------
// UTILITY FUNCTIONS: 
// --------------------------------------------------------

function html(html) {
  var template = document.createElement('template');
  html = html.trim()
  template.innerHTML = html;
  return template.content.firstChild;
}

function $(selector) {
  return document.querySelector(selector);
} 

function $$(selector) {
  return document.querySelectorAll(selector)
}

function replaceAt(str, idx) {
  return str.slice(0,idx) + '#' + str.slice(idx + 1)
}

function pipe (...fns) {
  return x => fns.reduce((v, f) => f(v), x)
}

function cssVar(cssVar) {
  return getComputedStyle(document.body).getPropertyValue(`--${cssVar}`)
}

// TODO: I should change all refrences to rows to be zero based. There is way too much adding/subtracting 1 going on.

function getTiles() {
  const tiles = []
  for (let i = 0; i < 6; i++) {
    tiles.push(...$(`#row-${i}`)?.children || []);
  }
  return tiles;
}

function pointer ({gameBoard} = State) {
  return gameBoard.reduce((acc, cur, idx, arr) => {
    if ((!cur?.letter && !acc) || idx==arr.length -1 ) return idx
    return acc
  }, 0)
}


function rowNum(point=State.pointer) {
  if(point<0) point = 0
  return Math.floor(point / 5);
}

function activeRow({checked}=State) {
  return checked.filter(i => i).length
}

function isRowDone({checked, pointer} = State) {
  return (!checked[rowNum() -1] && ((rowNum(pointer -1) < rowNum())))
}

function guesses(gameBoard) {
  return gameBoard.reduce((acc,cur,idx, arr) => {
    let groupNum = Math.floor(idx/5)
    acc[groupNum] = (acc?.[groupNum] ?? '') + (cur.letter || '')
    return acc
  }, [])
}

function getRowEls(rowNumber = activeRow(), kids = true) {
  rowNumber = rowNumber == 6 ? 5 : rowNumber
  const row = $(`#row-${rowNumber}`)
  if (!kids) return row
  return [...row?.children] ?? [];
}

function collect(arr) {
  return arr.reduce((acc, cur) => acc + cur.innerText.toLowerCase(), '');
}

function clone (obj) {
  return JSON.parse(JSON.stringify(obj || {}))
}

function randomIdx (arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateWinningMessage(winningRow) {
  const generalPraises = ['You Won!', 'Great Job!','You Rock!','Pure Genius!', 'Wonderful','Beautiful!','Gold Star!','Nice!','Very Cool!','You got it!','Keep it up!','wow!','incredible!','cheers!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Way To Go!']
  const lastLinePraises = ['phew!','close call!','I was worried about you there!']
  const firstLinePraises = ['impossible!','I can\'t believe it!','How\'d you know?!','genius!','Cheater!']
  
    return (winningRow == 0 )
      ? randomIdx(firstLinePraises)
      : (winningRow == 6) 
        ? randomIdx(lastLinePraises)
        : randomIdx(generalPraises)
}

function getColorScheme () {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change",   e => {
      State.colorScheme = e.matches 
        ? 'dark' 
        : 'light'
        paint(State, State)
      }  );
}

function getEmojiGameBoard () {
  // console.log({State})
  return State.gameBoard.reduce((acc, cur, idx) => {
    console.log(idx + 1, (idx + 1) % 5)
    const newLine = ((idx+1) % 5 == 0) ? '\n' : '';
    const bgColor = getRowValidityMask(rowNum(idx),State)[idx % 5]
    // console.log({bgColor})
    if(bgColor == 'rightSpot') return acc + '🟩' + newLine
    if(bgColor == 'wrongSpot') return acc + '🟨' + newLine
    return acc + '⬜' + newLine
  },'')
}

function setup () {
  getColorScheme()
  const possibleWordsWorker = new Worker('possibleWords.js');
  possibleWordsWorker.postMessage('')
  possibleWordsWorker.onmessage = function(e) {
    if (typeof e.data !== 'object') return
    State.wordle = e.data.randomWord
    possibleWords = e.data.possibleWordsMap 
  }
  return possibleWordsWorker
}



// function makeGradient(...colors, steps = 5) {
//   const result = []
//   for(let c1 = 0, c2 = 1; c2 < colors.length; c1++, c2++ ) {
//     for (let i = 0; i < Math.floor(colors.length/steps); i++) {
//       let alpha = i / (n-1);  // 0.0 <= alpha <= 1.0 
//       let L = (1-alpha) * c1.L + alpha * c2.L;
//       let a = (1-alpha) * c1.a + alpha * c2.a;
//       let b = (1-alpha) * c1.b + alpha * c2.b;
//       result.push({L, a, b})
//     }
//   }
//   return result
// }