/* Constructeur de phrases du chat : blocs de mots et émojis (pas de texte libre, pour que ça reste sympa) */
export const WORDS = ["Je", "Tu", "On", "Il", "Elle", "Nous", "Mon équipe", "Ton équipe", "Mon gardien", "Ton gardien", "L'ordi", "Le PSG", "L'OM", "Messi", "Ronaldo", "Mbappé", "joue", "gagne", "perd", "marque", "arrive", "suis prêt", "es prêt ?", "es trop fort", "est trop fort", "veux une revanche", "ai eu une légende", "ouvre un pack", "t'attends", "rigole", "a raté", "dort", "est trop chaud", "fait une retournée", "a trop de chance", "triche pas 😂", "reviens", "pars", "vais gagner", "vas perdre", "aime", "veux", "as", "un match", "un but", "une retournée", "un pack", "une carte", "mes cartes", "tes cartes", "une légende", "une Ultime", "le ballon", "le classement", "mon équipe", "un échange", "un duel de packs", "la revanche", "ce but", "maintenant", "ce soir", "demain", "dans 5 minutes", "tout de suite", "encore", "après", "en ligne", "dans ma salle", "contre l'ordi", "à plusieurs", "en 2 contre 2", "à la récré", "ce week-end", "et", "mais", "trop", "vraiment", "pas", "bien", "fort", "nul", "vite", "GG", "bravo", "merci", "désolé", "stp", "oui", "non", "ok", "mdr", "ptdr", "grave", "franchement", "wow", "allez", "go", "!", "?", "!!!", "...", ",", "?!"];
export const WGROUPS = [{"id": "qui", "n": "Qui", "w": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]}, {"id": "action", "n": "Action", "w": [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42]}, {"id": "quoi", "n": "Quoi", "w": [43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58]}, {"id": "quand", "n": "Quand / où", "w": [59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72]}, {"id": "mots", "n": "Petits mots", "w": [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96]}, {"id": "ponct", "n": "Ponctuation", "w": [97, 98, 99, 100, 101, 102]}];
export const EMOJIS = ["😀", "😂", "😎", "👍", "👋", "❤️", "⚽", "🔥", "🏆", "🎉", "😤", "🤝", "💪", "😱", "🐐", "👑", "🥶", "🤯", "💯", "⚡", "🚀", "🌟", "🦄", "🌋", "🎮", "🥇", "🧤", "🏟️", "🧠", "💎", "🦁", "🐉", "👽", "🪐"];
export const EMO = 1000; // une partie >= 1000 = émoji
const NOSP = new Set([',']); // en français : espace avant ! et ?, pas avant la virgule
/** Transforme une liste de blocs en phrase lisible */
export function sentence(parts) {
  let s = '';
  for (const x of parts || []) {
    const t = x >= EMO ? EMOJIS[x - EMO] : WORDS[x];
    if (t == null) continue;
    s += (s && !(x < EMO && NOSP.has(t)) ? ' ' : '') + t;
  }
  return s;
}
