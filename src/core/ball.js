// Ball model. A ball is a plain object { id, kind, color, weight }.
//
// kind:   'normal' | 'joker' | 'bomb' | 'heart' | 'star'
// color:  0..6 for normal balls, null for specials
// weight: 1..4 for normal balls (merged balls can exceed 4); specials are
//         weightless per the original manual ("Spezialkugeln haben kein Gewicht").

export const MAX_WEIGHT = 4;

// The color class used by match detection. Jokers are wildcards (null),
// bombs never match (Symbol-free sentinel 'bomb' is filtered by callers).
export function colorClassOf(ball) {
  switch (ball.kind) {
    case 'normal': return ball.color;
    case 'heart': return 'heart';
    case 'star': return 'star';
    default: return null; // joker (wildcard), bomb (unmatchable)
  }
}
