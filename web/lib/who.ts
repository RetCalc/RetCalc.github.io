/* The two people in a household, as a tool's words say them. On the site
   nobody is named, so it's "you" and "your spouse"; in the Dashboard each
   person's name from the profile takes their place, wherever one is given
   (a name left blank keeps the usual word). */

export interface Who {
  /** Whether either person has a name. */
  named: boolean;
  /** Each one's name as given: "" for none. */
  name1: string;
  name2: string;
  /** "Sam" or "You": a label, a column's head, a sentence's start. */
  one: string;
  /** "Alex" or "Spouse". */
  two: string;
  /** "Sam" or "you", mid-sentence. */
  oneIn: string;
  /** "Alex" or "your spouse", mid-sentence. */
  twoIn: string;
  /** "Sam's" or "Your". */
  oneOwn: string;
  /** "Alex's" or "Spouse's", as a label. */
  twoOwn: string;
  /** "Sam's" or "your", mid-sentence. */
  oneOwnIn: string;
  /** "Alex's" or "your spouse's", mid-sentence. */
  twoOwnIn: string;
  /** "Sam is" or "you are"; "Alex is" or "your spouse is". */
  oneIs: string;
  twoIs: string;
}

const own = (n: string) => n + "'s";

/** The words for a household's two people, from their names (blank: none). */
export function whoWords(names?: readonly [string, string] | null): Who {
  const a = names?.[0]?.trim() ?? "", b = names?.[1]?.trim() ?? "";
  return {
    named: !!(a || b), name1: a, name2: b,
    one: a || "You", two: b || "Spouse",
    oneIn: a || "you", twoIn: b || "your spouse",
    oneOwn: a ? own(a) : "Your", twoOwn: b ? own(b) : "Spouse's",
    oneOwnIn: a ? own(a) : "your", twoOwnIn: b ? own(b) : "your spouse's",
    oneIs: a ? a + " is" : "you are", twoIs: b ? b + " is" : "your spouse is",
  };
}

/** The words with nobody named: the site's own. */
export const NO_NAMES: Who = whoWords(null);
