# Task 13 — Tour route quality: a show every night or two, the whole way down and back

## Owner test (2026-11-16)
"i want to tour 20 days bellingham to san diego and back tacoma find me clubs and places to stay with record stores and radio stations there and back and calculate the cost"
Expectation: "every 2 hours or so there is a stop with many clubs", "a few clubs in each town on I-5" (the "I-5 killers tour").

## Fixed already (2026-11-16, PRs #365, #366, #368)
- The brief parser reads one-way and natural sentences, including "and back <town>" as a return stop.
- Any north–south West Coast run uses the full I-5/coast circuit (33 markets Bellingham → San Diego). The live test now researches 23 markets: Seattle, Tacoma, Portland, Medford, San Francisco, Santa Ana, Oakland, Corvallis…

## Still wrong in the live result
1. **Too few shows.** With no show count in the brief it defaulted to 8 shows in 20 days, with long "Travel / rest" runs. Default to about 70% of days, min 1 day off per 5–6 shows (task 06 rules), e.g. 20 days → 14 shows.
2. **The turnaround city isn't played.** San Diego (the destination) got no show. The destination is always a show night, and LA and San Diego both get shows on a Bellingham–San Diego run.
3. **The return leg repeats the way down** (Oakland after Santa Ana). Use different towns on the way back where the circuit allows (e.g. down the coast, back via I-5/Central Valley: Bakersfield, Fresno, Stockton, Chico, Eugene, Olympia), ending at the requested return town (Tacoma) before home.
4. **Drive limits.** No day over the max drive (default 6 h); show nights are no more than ~2–4 hours apart where the circuit has markets.
5. **Clubs per town.** Show 2–4 clubs per show town (best first). Some rows showed an empty club cell; fill it or mark "No solid club lead yet — search again".
6. **Lodging + record stores + radio per stop.** Each show town shows a sleep option (host/couch, campground/free van parking, budget hotel), and the directory's record stores and radio stations near it (task 09 seed + live search).
7. **Cost.** Show the tour cost total (fuel, sleeping, food, promo) and per-show break-even, from the Tour Manager budget (task 06).

## Tests
Use the owner's sentence as the fixture: ≥ 12 shows in 20 days, San Diego and LA both get shows, Tacoma appears on the return leg, no leg over the max drive, every show town lists ≥ 2 clubs or an honest "no lead", and cost totals appear.
