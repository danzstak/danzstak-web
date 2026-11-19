// Owner export of the club database as CSV (opens in Excel or Google Sheets).
// In AWS CloudShell, from the repo:
//   aws dynamodb scan --region us-west-1 --table-name DANZSTAK-VenueDirectory --output json | node scripts/export-club-directory.mjs > danzstak-clubs.csv
// Then Actions > Download file > danzstak-clubs.csv. Public business contacts only; no band names.
import { clubCsv } from "../infrastructure/auth-api/club-directory.mjs";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const items = (JSON.parse(input || "{}").Items || []).filter(item => item.venueKey?.S && !item.venueKey.S.startsWith("meta-"));
process.stdout.write(clubCsv(items));
