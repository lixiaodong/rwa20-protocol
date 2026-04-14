#!/usr/bin/env node
/**
 * RWA20 Protocol — Outreach Automation Script
 *
 * Sends personalized email introductions to industry contacts.
 * Uses nodemailer with Gmail (or any SMTP provider).
 *
 * Setup:
 *   npm install nodemailer dotenv
 *   cp .env.example .env  # fill in SMTP credentials
 *   node outreach/send-outreach.js --dry-run          # preview all emails
 *   node outreach/send-outreach.js --category vc      # send to VCs only
 *   node outreach/send-outreach.js --contact "Sid Powell"  # send to one person
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const SENDER_NAME  = process.env.SENDER_NAME  || 'RWA20 Protocol Team';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'lxd422152276@gmail.com';
const SENDER_SIGNATURE = `
--
${SENDER_NAME}
RWA20 Protocol
GitHub: https://github.com/lxd422152276/rwa20-protocol
Website: https://lxd422152276.github.io/rwa20-protocol/
Email: ${SENDER_EMAIL}
`.trim();

// ─── LOAD DATA ────────────────────────────────────────────────────────────────

const targets   = JSON.parse(fs.readFileSync(path.join(__dirname, 'targets.json'), 'utf8'));
const templates = JSON.parse(fs.readFileSync(path.join(__dirname, 'templates.json'), 'utf8'));

// ─── TEMPLATE ENGINE ──────────────────────────────────────────────────────────

function render(template, contact) {
  let text = template;
  const vars = {
    name:  contact.name.split(' ')[0],         // first name
    org:   contact.org,
    focus: contact.focus,
    role:  contact.role,
  };
  for (const [key, value] of Object.entries(vars)) {
    text = text.replaceAll(`{{${key}}}`, value || '');
  }
  return text;
}

// ─── BUILD EMAIL LIST ─────────────────────────────────────────────────────────

function buildEmailList(filterCategory, filterContact) {
  const emails = [];
  for (const [catKey, category] of Object.entries(targets.categories)) {
    if (filterCategory && catKey !== filterCategory) continue;
    for (const contact of category.contacts) {
      if (filterContact && contact.name !== filterContact) continue;
      if (!contact.email) continue;
      const tmpl = templates.templates[contact.persona];
      if (!tmpl) { console.warn(`⚠️  No template for persona: ${contact.persona}`); continue; }
      emails.push({
        contact,
        category: catKey,
        to: `${contact.name} <${contact.email}>`,
        subject: render(tmpl.subject, contact),
        text: render(tmpl.body, contact) + '\n\n' + SENDER_SIGNATURE,
      });
    }
  }
  return emails;
}

// ─── SMTP TRANSPORT ──────────────────────────────────────────────────────────

function createTransport() {
  // Gmail: requires App Password (https://support.google.com/accounts/answer/185833)
  // Other providers: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  // Gmail shortcut
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,  // NOT your regular password
    },
  });
}

// ─── SEND WITH RATE LIMITING ──────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendEmails(emails, isDryRun) {
  const transport = isDryRun ? null : createTransport();
  const log = [];

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`RWA20 Outreach — ${isDryRun ? 'DRY RUN' : 'LIVE SEND'}`);
  console.log(`Total emails: ${emails.length}`);
  console.log('─'.repeat(60));

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    console.log(`\n[${i+1}/${emails.length}] ${email.contact.name} · ${email.contact.org}`);
    console.log(`  To:      ${email.to}`);
    console.log(`  Subject: ${email.subject}`);

    if (isDryRun) {
      console.log(`  Body preview:\n${email.text.split('\n').slice(0,4).map(l => '  │ ' + l).join('\n')}\n  │ ...`);
      log.push({ ...email.contact, status: 'dry-run', subject: email.subject });
      continue;
    }

    try {
      await transport.sendMail({
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: email.to,
        subject: email.subject,
        text: email.text,
      });
      console.log(`  ✅ Sent`);
      log.push({ ...email.contact, status: 'sent', sentAt: new Date().toISOString() });
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      log.push({ ...email.contact, status: 'error', error: err.message });
    }

    // Rate limit: 1 email per 3 seconds to avoid spam filters
    if (i < emails.length - 1) {
      console.log(`  Waiting 3s...`);
      await sleep(3000);
    }
  }

  // Save log
  const logPath = path.join(__dirname, `outreach-log-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Done. Log saved to: ${logPath}`);
  return log;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDryRun     = args.includes('--dry-run');
  const catIdx       = args.indexOf('--category');
  const contactIdx   = args.indexOf('--contact');
  const listIdx      = args.indexOf('--list');

  const filterCategory = catIdx !== -1 ? args[catIdx + 1] : null;
  const filterContact  = contactIdx !== -1 ? args.slice(contactIdx + 1).join(' ').split('--')[0].trim() : null;

  if (args.includes('--help')) {
    console.log(`
RWA20 Outreach Script
Usage: node send-outreach.js [options]

Options:
  --dry-run                Preview emails without sending
  --category <name>        Only send to category: ${Object.keys(targets.categories).join(', ')}
  --contact <full name>    Only send to one specific contact
  --list                   List all contacts and exit

Examples:
  node send-outreach.js --dry-run
  node send-outreach.js --dry-run --category vc
  node send-outreach.js --category media
  node send-outreach.js --contact "Brady Dale"
`);
    process.exit(0);
  }

  const emails = buildEmailList(filterCategory, filterContact);

  if (args.includes('--list') || listIdx !== -1) {
    console.log(`\nAll contacts (${emails.length} total):\n`);
    let current = '';
    for (const e of emails) {
      if (e.category !== current) {
        current = e.category;
        console.log(`\n── ${current.toUpperCase()} ─────────────────────`);
      }
      console.log(`  ${e.contact.name.padEnd(28)} ${e.contact.org.padEnd(25)} ${e.contact.email}`);
    }
    process.exit(0);
  }

  if (emails.length === 0) {
    console.log('No contacts found matching the filter.');
    process.exit(0);
  }

  if (!isDryRun && !process.env.GMAIL_USER && !process.env.SMTP_HOST) {
    console.error(`
❌ Error: No SMTP credentials configured.

Add to your .env file:
  GMAIL_USER=your@gmail.com
  GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # Gmail App Password
  SENDER_NAME=Your Name

Or use custom SMTP:
  SMTP_HOST=smtp.sendgrid.net
  SMTP_PORT=587
  SMTP_USER=apikey
  SMTP_PASS=your_api_key
  SENDER_EMAIL=you@yourdomain.com
  SENDER_NAME=Your Name

Run with --dry-run to preview without sending.
`);
    process.exit(1);
  }

  await sendEmails(emails, isDryRun);
}

main().catch(err => { console.error(err); process.exit(1); });
