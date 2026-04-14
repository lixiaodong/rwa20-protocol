# RWA20 Outreach System

A targeted email outreach system for building awareness and contributions for the RWA20 Protocol.

## Structure

```
outreach/
├── targets.json          — Contact list organized by category
├── templates.json        — Persona-specific email templates
├── send-outreach.js      — Node.js automation script
└── README.md             — This file
```

## Contact Categories

| Category | Count | Purpose |
|---|---|---|
| `rwa_projects` | 5 | Existing RWA platforms — potential adopters / collaborators |
| `defi_influencers` | 4 | DeFi thought leaders — credibility and amplification |
| `institutional_finance` | 4 | TradFi firms tokenizing assets |
| `legal_compliance` | 3 | Law firms — jurisdiction module co-authors |
| `regulators_standards` | 3 | Regulators — official engagement and recognition |
| `vc_investors` | 4 | VCs — ecosystem support and funding |
| `media_research` | 3 | Journalists — coverage and story tips |

## Setup

```bash
cd outreach
npm install nodemailer dotenv
```

Configure Gmail (recommended for personal outreach):
1. Enable 2FA on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Create App Password for "Mail"
4. Add to your `.env` file (in project root):

```env
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
SENDER_NAME=Your Full Name
```

## Usage

```bash
# Preview all emails (no sending)
node outreach/send-outreach.js --dry-run

# List all contacts
node outreach/send-outreach.js --list

# Preview one category
node outreach/send-outreach.js --dry-run --category media

# Send to one category
node outreach/send-outreach.js --category media

# Send to one specific person
node outreach/send-outreach.js --contact "Brady Dale"

# Send everything (carefully!)
node outreach/send-outreach.js
```

## Outreach Strategy

### Phase 1 — Media First (Week 1)
Start with journalists. A single article in CoinDesk or Blockworks can generate more awareness than 100 cold emails.

```bash
node outreach/send-outreach.js --category media
```

### Phase 2 — Builders (Week 2)
Reach out to existing RWA platforms — they may want to adopt the standard or collaborate.

```bash
node outreach/send-outreach.js --category rwa_projects
```

### Phase 3 — Legal (Week 2-3)
Law firms can become trusted attestors and co-author jurisdiction documentation — great for credibility.

```bash
node outreach/send-outreach.js --category legal_compliance
```

### Phase 4 — DeFi Influencers (Week 3)
Engagement from known DeFi figures amplifies organic reach significantly.

```bash
node outreach/send-outreach.js --category defi_influencers
```

### Phase 5 — VCs + Institutional (Week 4)
Only after you have some traction signals (GitHub stars, press, contributions).

```bash
node outreach/send-outreach.js --category vc_investors
node outreach/send-outreach.js --category institutional_finance
```

### Phase 6 — Regulators (Ongoing)
Regulatory engagement is a long game — start with a formal introductory letter and be patient.

```bash
node outreach/send-outreach.js --category regulators_standards
```

## Customizing Templates

Edit `templates.json` to customize messages per persona. Supported variables:

| Variable | Value |
|---|---|
| `{{name}}` | Contact's first name |
| `{{org}}` | Organization name |
| `{{focus}}` | Contact's area of focus |
| `{{role}}` | Contact's role/title |

## Adding Contacts

Add entries to `targets.json` under the appropriate category:

```json
{
  "name": "Full Name",
  "role": "Title",
  "org": "Organization",
  "email": "email@domain.com",
  "twitter": "@handle",
  "focus": "brief description of their focus area",
  "persona": "builder|influencer|legal|regulator|vc|institutional|media"
}
```

## Follow-Up Tracking

Each send run creates a log file `outreach-log-{timestamp}.json` with status for each contact. Use this to:
- Track who has been contacted
- Follow up with non-responders after 5-7 days
- Note any responses and adjust templates

## Tips for Higher Response Rates

1. **Personalize beyond variables** — Mention a specific tweet, article, or product feature of theirs
2. **Send Tuesday–Thursday, 9am–11am** in recipient's timezone
3. **Short subject lines** — Under 50 characters
4. **Plain text over HTML** — Higher deliverability, feels more personal
5. **One clear ask** — Don't ask for too many things in one email
6. **Follow up once** — After 5-7 days, a short "bumping this up" is fine; after that, let it go
