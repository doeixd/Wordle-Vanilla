1. A particular letter (e.g. 'N') will only 'light up' (be colored green or yellow) as many times as it is in the word.

Yesterday's word was BANAL, which only contains one 'N' and one 'L'. So in my guesses of ANNAL, UNION and ALLOY only one 'N' or 'L' lights up.

By contrast, BANAL contains two As, and both As in ANNAL light up.

2. If you repeat a letter more times than it is contained in the word, and one of the repeated letters is in the correct position, that letter will always light up in green.

In ANNAL the 'N' in slot 3 is in the right position, so it is lit up in green.

3. If you repeat a letter more times than it is contained in the word, but none of the repeated letters is in the correct position, the first letter will light up in yellow.

In UNION, neither N is in the correct position. So the 'N' in slot 2 gets lit up in yellow. This implicitly also tells you that the N is not in position 5 - otherwise, that N would have lit up in green instead.

Similarly, none of the Ls in ALLOY are in the right position, so the L in slot 2 lights up - but this implicitly tells you that slot 3 is not right for the L either.


if letter is in word remove letter from wordle

apply styles



  // console.log({letter})
  const commonStyles = 
  let backgroundColor = `var(--wrongSpotColor)`
  const match = wordle.match(letter.toLowerCase())
  //if(match && match.length == 1 || )
  if(!match) backgroundColor = `var(--wrongLetterColor)`
  if(letter == wordle[(idx) % 5]) backgroundColor = `var(--rightSpotColor)`
  const styles = { backgroundColor: backgroundColor , ...commonStyles}

  return styles


    sumbittedRow.forEach((tile, idx) => {
      tile.classList.remove('guessedLetter')
      const letter = tile?.innerText.toLowerCase() ?? ''
      const guess = collect(getRowEls());
      const styles = getValidityStyles(idx, oldState);
      ;(tile.animate([
        {transform: 'rotate3d(50, 0, 0, -180deg)',...styles},
        {transform: 'rotate3d(0,0,0, 180deg)', ...styles}
      ],{
        duration: 650,
        delay: (idx *300) + 50,
        easing: 'ease-in-out',
      })).onfinish = _ => {
        setStylesOnElement(styles, tile)
        setStylesOnElement(styles, $(`#${letter}`));
        console.log('won: ', {newState})
        if(newState.won && !idx) animateWinningRow(oldState, newState)
      }
  })


    let idx = 0
  let finished = false

  for (const idx in sumbittedRow) {
    const tile = sumbittedRow?.[idx]
    
    tile.classList.remove('guessedLetter')
    const letter = tile?.innerText.toLowerCase() ?? ''

    const guess = collect(getRowEls())
    const styles = getValidityStyles(idx, oldState);
    ;(tile.animate([
      {transform: 'rotate3d(50, 0, 0, -180deg)',...styles},
      {transform: 'rotate3d(0,0,0, 180deg)', ...styles}
    ],{
      duration: 650,
      delay: (idx *300) + 50,
      easing: 'ease-in-out',
    })).onfinish = _ => {
      setStylesOnElement(styles, tile)
      const keyboardLetterButtonEl = $(`#${letter}`)
      setStylesOnElement(styles, keyboardLetterButtonEl)
    }
  }
  
  if(newState.won && !idx) return animateWinningRow


  
function animateSumbittedRowNEW (oldState, newState) {
  // console.log({row: activeRow(oldState)})
  if(activeRow(oldState) >= activeRow(newState)) return
  const sumbittedRow  = getRowEls(activeRow(oldState))
  $$(`#row-${activeRow(oldState)} box`).forEach(tile => {
    tile.classList.add('sumbitted')
  })
  if(newState.won && !idx) setTimeout(() => animateWinningRow(sumbittedRow), 1250)
}



g - soils
w - soles

1. A particular letter (e.g. 'N') will only 'light up' (be colored green or yellow) as many times as it is in the word.
2. If you repeat a letter more times than it is contained in the word, and one of the repeated letters is in the correct position, that letter will always light up in green.
3. If you repeat a letter more times than it is contained in the word, but none of the repeated letters is in the correct position, the first letter will light up in yellow.

g - soils
o - oaths



Todo - Urgent Bugs
null


TODO - Features
share created game
OG mode
  timer
user accounts
instructions modal
colored stats
accessability
back button shows options modal
hint
PWA
  service worker
  manifest
  Icons
variable wordle lengths



TODO - Chores
fix checked off by one
fix gameboard stuff
fix pointer logic
fix adding styles
test persistance 
add typescript

