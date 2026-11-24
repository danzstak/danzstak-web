// Task 20 (owner 2026-11-17): famous names always go to a DanzStak editor, even when an automatic check passes.
// Starts with widely streamed artists plus the punk, metal and electronic names DanzStak's scenes book most;
// any act a member reports joins the list at run time (ARTIST_VERIFICATION#PROTECTED_NAMES in the tours table).
// Matching ignores case, spacing, accents, "the", "official" and common look-alike characters (see lookalikeKey).
export const PROTECTED_ARTIST_NAMES = Object.freeze([
  // Most-streamed pop, hip-hop, Latin and R&B
  "Taylor Swift", "Drake", "Bad Bunny", "The Weeknd", "Ed Sheeran", "Ariana Grande", "Justin Bieber", "Billie Eilish",
  "Post Malone", "Eminem", "Rihanna", "Kanye West", "Ye", "BTS", "Coldplay", "Imagine Dragons", "Travis Scott",
  "Dua Lipa", "Kendrick Lamar", "SZA", "Bruno Mars", "Katy Perry", "Lady Gaga", "Beyonce", "Harry Styles",
  "Olivia Rodrigo", "Sabrina Carpenter", "Morgan Wallen", "Doja Cat", "Future", "21 Savage", "Lana Del Rey",
  "Arctic Monkeys", "Maroon 5", "Shakira", "J Balvin", "Karol G", "Peso Pluma", "Feid", "Metro Boomin",
  "Adele", "Sam Smith", "Miley Cyrus", "Selena Gomez", "Shawn Mendes", "Charli XCX", "Chappell Roan",
  "Tyler, The Creator", "Frank Ocean", "Nicki Minaj", "Cardi B", "Megan Thee Stallion", "Lil Wayne",
  "Snoop Dogg", "Jay-Z", "Bob Marley", "Elton John", "Madonna", "Michael Jackson", "Prince", "Queen",
  "The Beatles", "The Rolling Stones", "Pink Floyd", "Led Zeppelin", "Fleetwood Mac", "Bon Jovi",
  "Red Hot Chili Peppers", "Foo Fighters", "Nirvana", "Radiohead", "Gorillaz", "Tame Impala", "Rosalia",
  "Stray Kids", "BLACKPINK", "NewJeans", "Burna Boy", "Wizkid", "Tems",
  // Electronic
  "David Guetta", "Calvin Harris", "Marshmello", "Martin Garrix", "Tiesto", "Avicii", "Skrillex", "deadmau5",
  "Daft Punk", "Fred again..", "Peggy Gou", "Charlotte de Witte", "Amelie Lens", "Carl Cox", "Richie Hawtin",
  "Adam Beyer", "The Chainsmokers", "Swedish House Mafia", "Kygo", "Zedd", "Diplo", "Major Lazer", "Disclosure",
  "Bicep", "Fisher", "John Summit", "Dom Dolla", "Anyma", "Eric Prydz", "Armin van Buuren", "Hardwell",
  "The Prodigy", "Chemical Brothers", "Aphex Twin", "Four Tet", "Jamie xx", "Boris Brejcha", "Solomun",
  "Black Coffee", "Kaytranada", "Flume", "ODESZA", "Rufus Du Sol", "Illenium", "Excision", "Subtronics",
  // Metal
  "Metallica", "Iron Maiden", "Slayer", "Megadeth", "Black Sabbath", "Ozzy Osbourne", "Slipknot", "Rammstein",
  "System of a Down", "Linkin Park", "Avenged Sevenfold", "Ghost", "Gojira", "Tool", "Pantera", "Judas Priest",
  "Motorhead", "Lamb of God", "Mastodon", "Bring Me the Horizon", "Korn", "Sleep Token", "Babymetal",
  "Dream Theater", "Opeth", "Behemoth", "Cannibal Corpse", "Arch Enemy", "Sepultura", "Anthrax", "Deftones",
  "Disturbed", "Five Finger Death Punch", "Trivium", "Machine Head", "Killswitch Engage", "Architects",
  // Punk
  "Green Day", "Blink-182", "The Offspring", "Bad Religion", "Ramones", "Sex Pistols", "The Clash",
  "Dead Kennedys", "Misfits", "Rancid", "NOFX", "Social Distortion", "Black Flag", "Fugazi", "Minor Threat",
  "Bad Brains", "Descendents", "Pennywise", "Rise Against", "Dropkick Murphys", "Against Me!", "IDLES",
  "Turnstile", "Amyl and the Sniffers", "The Damned", "Buzzcocks", "Circle Jerks", "Subhumans", "Crass",
  "Anti-Flag", "Sum 41", "Good Charlotte", "My Chemical Romance", "Paramore", "Fall Out Boy", "AFI"
]);
