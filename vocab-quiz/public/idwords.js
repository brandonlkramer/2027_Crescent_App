// Crescent ID word lists: an ID is one word from each list, in order (16^4 = 65,536 IDs).
// Within a list every word starts with a different letter and has its own picture.
// The same lists are copied into tools/crescent-roster-tool.html — keep them identical.
window.CRESCENT_ID_LISTS = [
  { title: "どうぶつ", words: [
    ["bear","🐻"],["cat","🐱"],["dog","🐶"],["eagle","🦅"],["fish","🐟"],["goat","🐐"],["horse","🐴"],["lion","🦁"],
    ["monkey","🐵"],["owl","🦉"],["pig","🐷"],["rabbit","🐰"],["snake","🐍"],["tiger","🐯"],["whale","🐳"],["zebra","🦓"] ] },
  { title: "たべもの", words: [
    ["apple","🍎"],["bread","🍞"],["cake","🍰"],["donut","🍩"],["egg","🥚"],["grape","🍇"],["honey","🍯"],["juice","🧃"],
    ["lemon","🍋"],["melon","🍈"],["noodle","🍜"],["orange","🍊"],["pizza","🍕"],["rice","🍚"],["salad","🥗"],["tea","🍵"] ] },
  { title: "しぜん", words: [
    ["beach","🏖️"],["cloud","☁️"],["desert","🏜️"],["earth","🌍"],["fire","🔥"],["island","🏝️"],["leaf","🍃"],["moon","🌙"],
    ["night","🌃"],["ocean","🌊"],["plant","🌱"],["rain","🌧️"],["snow","❄️"],["tree","🌳"],["volcano","🌋"],["wind","💨"] ] },
  { title: "もの", words: [
    ["ball","⚽"],["car","🚗"],["drum","🥁"],["flag","🚩"],["guitar","🎸"],["hat","🎩"],["jacket","🧥"],["key","🔑"],
    ["letter","✉️"],["map","🗺️"],["piano","🎹"],["rocket","🚀"],["ship","🚢"],["train","🚆"],["umbrella","☂️"],["watch","⌚"] ] },
];

// Check symbol printed on each ID slip: one of 8, worked out from the four words.
// Students tap it after choosing their words; a wrong word almost always gives a different symbol.
window.CRESCENT_SYMBOLS = [["●","#d32f2f"],["▲","#1565c0"],["■","#2e7d32"],["★","#ef8f00"],["♥","#d81b60"],["◆","#6a1b9a"],["✚","#00838f"],["☾","#5d4037"]];
window.crescentSymbolOf = function (id) {
  let h = 2166136261;
  for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % window.CRESCENT_SYMBOLS.length;
};
