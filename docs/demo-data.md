# Demo data

The demo adapter builds its data in memory from a **fixed random seed** (e.g. a small `mulberry32(20261105)`),
so every visitor sees the same farms, and it runs fast in a browser. All dates are **relative to today in
Asia/Kolkata**: "yesterday" always has milk entries, and some vaccines are always overdue.

The headline numbers will be smaller than in the screenshots (the prototype shows 1,284 farmers). That's
expected: **match the layout, not the totals.** Every number on screen must be computed from the demo data.

## Size

| Item | Count | Notes |
| --- | --- | --- |
| Farmers (profiles) | 60 | Languages roughly: Hindi 30%, Marathi 25%, Gujarati 15%, Tamil 12%, Malayalam 10%, English 8% |
| Farms | 66 | 6 farmers own two farms. States: MH, GJ, UP, TN, KL, HR, with a district on each |
| Farms with a Blackbox | 9 | Their cattle wear collars (`hardware_tag_id` set) |
| Sheds | 1–4 per farm | Codes S1, S2…; names like "Main shed", "Buffalo shed", "Calf & goat shed" |
| Members | 1–4 per farm | Owner plus managers and workers, each a profile |
| Animals | about 900 | Cattle 55%, buffalo 20%, goats 15%, sheep, poultry, pig. About 3% sold, 1% deceased |
| Milk entries | 90 days | Per farm and session (morning and evening; afternoon on 10% of farms). Per animal on the 3 featured farms |
| Feed entries | 90 days | Per farm and day for green fodder, dry fodder and concentrate; silage on some farms |
| Vaccinations | about 1,500 | FMD, HS, BQ, Brucellosis, LSD. About 10% overdue, 20% due within 7 days, the rest upcoming or done |
| Health events | about 120 open, 300 resolved | Fever, mastitis, lameness, bloat, not eating; sources manual, sensor and gau |
| Reproduction cycles | about 250 open | About 25 in heat (5 with `golden_end` within 6 hours), 80 inseminated (30 waiting for slip verification), 140 pregnant (6 due within 7 days) |
| Collar readings | last 7 days, hourly | Only for collared animals. Body temperature 38.0–39.3 °C, 2–3 animals above 39.5 °C |
| Environment readings | last 7 days, hourly | For Blackbox farms, per shed; temperature 22–34 °C, humidity 40–85%, THI computed |
| Activity | last 90 days, daily | Collared animals only; minutes per state summing to about 24 hours |
| Activity log | 40 past entries | Spread over the last 14 days, by the staff below |

## Featured records (use these exact names, so the screens look like the prototype)

| Farm | Owner, language | Place | Mode | Notes |
| --- | --- | --- | --- | --- |
| Shree Ganesh Dairy | Ramesh Patil, Marathi | Kolhapur, Maharashtra | Blackbox + collars | 64 animals (41 cattle, 17 buffalo, 6 goats), 3 sheds, 5 members. Cows 01 Gauri, 02 Lakshmi, 04 Ganga, 07 Kamla (pregnant, may deliver in 6 days), 11 Shanti (in heat), 23 Bhuri (sold), 09 Moti (deceased) |
| Gir Gau Shala | Sunita Desai, Gujarati | Anand, Gujarat | Blackbox + collars | 29 cattle |
| Periyar Cattle Farm | Joseph Varghese, Malayalam | Kottayam, Kerala | Manual | 6 milking cows: 03 Ammini, 06 Neeli (sick), 08 Kuttan |
| Kaveri Farms | Murugan Selvam, Tamil | Erode, Tamil Nadu | Blackbox (offline since this morning) | 52 animals |
| Yadav Dairy | Rajendra Yadav, Hindi | Mathura, Uttar Pradesh | Manual | 45 animals; a milk entry of 75.0 L that should be 7.5 L, for the fix-entry demo |
| Singh Dairy | Deepak Rawat, Hindi | Karnal, Haryana | Manual | No entries for 5 days, so it shows as quiet |
| Lakshmi Farm | Lakshmi Narayanan, Tamil | Namakkal, Tamil Nadu | Manual | 9 animals |

## Staff accounts (demo sign-in)

| Name | Email | Role | Status |
| --- | --- | --- | --- |
| Anjali Menon | anjali@brainwired.demo | super_admin | active |
| Priya Sharma | priya@brainwired.demo | support | active |
| Rahul Deshmukh | rahul@brainwired.demo | support | active |
| Fatima Shaikh | fatima@brainwired.demo | viewer | active |
| Vikram Nair | vikram@brainwired.demo | support | invited (can't sign in until "accepting": signing in turns them active) |

Any password of 6+ characters works. The sign-in page shows a small "Demo accounts" helper listing these
emails. Pre-fill nothing.

## Photos

Use simple generated placeholders (an SVG with the animal's tag, or a slip card showing the tube number, as in
`design/screens/dialogs/insemination-slip.png`). No real photos and no external image URLs.

## Persistence

- The seed is never stored. Store only a **change log** (`{ op, table, id, patch, at, staff_id }[]`) in
  `localStorage['westock-admin-demo-v1']`, and replay it on load.
- If the stored log can't be parsed or replayed, discard it and start fresh. Don't crash.
- "Reset demo data" (user menu) clears the log and reloads.
