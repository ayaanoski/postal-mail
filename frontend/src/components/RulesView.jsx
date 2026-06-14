import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const englishRules = `# Email HTML Deliverability Rules
### For AI Audit & Auto-Correction Before Every Send

> **How to use:** Paste this ruleset + your email HTML to any AI and say:
> *"Audit this email HTML against the deliverability rules and fix every violation."*

---

## SECTION 1 — DOCTYPE & HEAD STRUCTURE

### Rule 1.1 — DOCTYPE must be declared
- ✅ Must start with: \`<!DOCTYPE html>\`
- ❌ Never send without DOCTYPE — breaks Outlook, Gmail rendering

### Rule 1.2 — Required meta tags in <head>
All four of these must be present:
\`\`\`html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="x-apple-disable-message-reformatting">
\`\`\`

### Rule 1.3 — <title> tag must be meaningful
- ✅ Good: <title>Invoice #DER-TYI-548 – TFN Technologies</title>
- ❌ Bad: <title>Email</title> or missing entirely

### Rule 1.4 — Outlook MSO conditional comment required
Must include inside <head>:
\`\`\`html
<!--[if mso]>
<noscript><xml>
  <o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings>
</xml></noscript>
<![endif]-->
\`\`\`

---

## SECTION 2 — SENDER & DOMAIN RULES

### Rule 2.1 — All domains must match
Every domain reference in the email must be from the **same root domain**:
- From address: billing@yourdomain.com
- Links: https://yourdomain.com/...
- Tracking pixel: https://track.yourdomain.com/...
- Unsubscribe URL: https://yourdomain.com/unsubscribe

### Rule 2.2 — No throwaway / suspicious tracking domains
- ❌ Never use: *.top, *.xyz, *.click, *.link domains for tracking
- ✅ Always use: a subdomain of your own verified sender domain

### Rule 2.3 — From name and domain must be consistent
- ✅ From: TFN Technologies <billing@tfntechnologies.com>
- ❌ Bad: TFN Technologies <billing@tfntocha.com>

---

## SECTION 3 — MERGE TAGS & TEMPLATE VARIABLES

### Rule 3.1 — Zero unfilled merge tags allowed
Before sending, scan the entire HTML for any of these patterns:
\`\`\`
{{variable}}  {variable}  %%variable%%  [variable]  *|variable|*
\`\`\`

### Rule 3.2 — Use your ESP's correct merge tag syntax
| ESP | Correct Syntax |
|---|---|
| Brevo | {{ contact.FIRSTNAME }} |
| SendGrid | {{name}} |
| Mailgun | %recipient.name% |
| Mailchimp | *|FNAME|* |

---

## SECTION 4 — TRACKING PIXEL RULES

### Rule 4.1 — Use ESP's built-in tracking only
- ✅ Turn on Open Tracking in your ESP dashboard

### Rule 4.2 — If adding a manual pixel, format it correctly
\`\`\`html
<img src="https://track.YOURDOMAIN.com/open/%%RECIPIENT_ID%%"
     width="1" height="1"
     style="display:none; border:0; outline:none;"
     alt="">
\`\`\`

### Rule 4.3 — No pixel stacking
- ❌ Never have 2+ tracking pixels in one email

---

## SECTION 5 — CONTENT RULES

### Rule 5.1 — No scam/panic content patterns
- ❌ "You have been charged" with a phone number to "cancel"
- ❌ "Call immediately", "Act now", "Do not ignore"

### Rule 5.2 — No all-caps words in body or headings
- ❌ CALL NOW, URGENT, FREE, ACT IMMEDIATELY

### Rule 5.3 — No highlighted / colored phone numbers
- ❌ <span style="background:#ffff00;">+1(828) 346-7495</span>

### Rule 5.4 — Phone numbers must NOT be in <h1> or <h2> tags

### Rule 5.5 — Text-to-image ratio
- ✅ Minimum 60% text, maximum 40% images

### Rule 5.6 — No spam trigger words in subject line
Avoid: Free, Winner, Urgent, Act now, Guaranteed, Cash, !!, $$$

---

## SECTION 6 — LEGAL COMPLIANCE

### Rule 6.1 — Physical mailing address REQUIRED
### Rule 6.2 — Working unsubscribe link REQUIRED
### Rule 6.3 — "Why am I receiving this" statement required

---

## SECTION 7 — HTML STRUCTURE RULES

### Rule 7.1 — All tables must have role="presentation"
### Rule 7.2 — Inline styles only (no external CSS)
### Rule 7.3 — No JavaScript whatsoever
### Rule 7.4 — No iFrames or embedded objects
### Rule 7.5 — Images must have alt text
### Rule 7.6 — Images must have explicit width and height
### Rule 7.7 — Max email width: 600px

---

## SECTION 8 — PREHEADER TEXT

### Rule 8.1 — Every email must have a preheader

---

## SECTION 9 — FOOTER REQUIREMENTS CHECKLIST

Every email footer must contain ALL of the following:
- Company legal name
- Physical address
- Contact email
- Unsubscribe link
- "Why you received this" line
- Copyright line

---

## SECTION 10 — FINAL PRE-SEND AUDIT CHECKLIST

\`\`\`
STRUCTURE
[ ] DOCTYPE present
[ ] All 5 meta tags present
[ ] MSO Outlook conditional comment present
[ ] <title> is descriptive

SENDER / DOMAINS
[ ] From name matches company name
[ ] From domain matches all link domains
[ ] No third-party / suspicious tracking domains

MERGE TAGS
[ ] Zero {{unfilled}} variables anywhere in HTML
[ ] Unsubscribe URL resolves correctly

TRACKING
[ ] Only ONE tracking pixel (from your own domain / ESP)
[ ] Pixel is 1x1, hidden, with alt=""

CONTENT
[ ] No ALL CAPS words
[ ] No highlighted phone numbers
[ ] No phone numbers in H1/H2
[ ] No scam/panic urgency language
[ ] 60%+ text (not image-heavy)
[ ] No spam trigger words in subject

LEGAL
[ ] Physical mailing address in footer
[ ] Working unsubscribe link
[ ] "Why you received this" statement

HTML
[ ] All tables have role="presentation"
[ ] No <script>, <iframe>, <form>, <object>
[ ] All images have alt attributes
[ ] All images have width + height
[ ] Max 600px container width
[ ] No external CSS stylesheets

PREHEADER
[ ] Preheader div present after <body>
[ ] Preheader padded with &nbsp;&zwnj; characters
[ ] Preheader under 90 chars of real content
\`\`\`
`;

const bengaliRules = `📧 *ইমেইল ডেলিভারি রুলস*
_প্রতিটা মেইল পাঠানোর আগে এগুলো চেক করো_

---

*সেকশন ১ — স্ট্রাকচার*

✅ ১. HTML শুরু করতে হবে \`<!DOCTYPE html>\` দিয়ে
✅ ২. Head-এ এই ৫টা meta tag থাকতে হবে:
  • charset="utf-8"
  • viewport (মোবাইলের জন্য)
  • X-UA-Compatible IE=edge
  • format-detection (অটো-লিংক বন্ধ রাখো)
  • x-apple-disable-message-reformatting
✅ ৩. Title tag-এ মিনিংফুল কিছু লিখতে হবে
✅ ৪. Outlook-এর জন্য MSO comment যোগ করতে হবে

---

*সেকশন ২ — সেন্ডার ও ডোমেইন*

✅ ৫. From email, সব লিংক ও ট্র্যাকিং পিক্সেল — সবই একই ডোমেইন হতে হবে
✅ ৬. .top / .xyz / .click / .link ট্র্যাকিংয়ে কখনো ব্যবহার করবে না
✅ ৭. From name আর domain মিলতে হবে

---

*সেকশন ৩ — মার্জ ট্যাগ*

✅ ৮. মেইল পাঠানোর আগে কোনো অপূর্ণ variable থাকা যাবে না
✅ ৯. তোমার ESP অনুযায়ী সঠিক merge tag ব্যবহার করো

---

*সেকশন ৪ — ট্র্যাকিং পিক্সেল*

✅ ১০. ESP-এর built-in open tracking চালু রাখো
✅ ১১. নিজে যোগ করলে সঠিক ফরম্যাটে দাও
✅ ১২. একটা মেইলে মাত্র একটাই পিক্সেল দেবে

---

*সেকশন ৫ — কন্টেন্ট*

✅ ১৩. ভয় দেখানো বা স্ক্যামের মতো ভাষা একদম না
✅ ১৪. কোথাও সব CAPS-এ লেখা যাবে না
✅ ১৫. ফোন নম্বরে কোনো রঙ বা highlight দেবে না
✅ ১৬. ফোন নম্বর H1 বা H2 ট্যাগে রাখবে না
✅ ১৭. কমপক্ষে ৬০% টেক্সট, সর্বোচ্চ ৪০% ছবি
✅ ১৮. Subject line-এ স্প্যাম শব্দ ব্যবহার করবে না

---

*সেকশন ৬ — আইনি বিষয়*

✅ ১৯. Footer-এ অফিসের ঠিকানা দিতে হবে
✅ ২০. Unsubscribe লিংক কাজ করতে হবে
✅ ২১. কেন এই মেইল পাচ্ছে সেটা লিখতে হবে

---

*সেকশন ৭ — HTML নিয়ম*

✅ ২২. সব table-এ role="presentation" থাকতে হবে
✅ ২৩. Style শুধু inline-এ দেবে
✅ ২৪. কোনো JavaScript রাখা যাবে না
✅ ২৫. iFrame, form বা object রাখা যাবে না
✅ ২৬. সব ছবিতে alt text দিতে হবে
✅ २७. সব ছবিতে width আর height দিতে হবে
✅ ২৮. মেইলের সর্বোচ্চ চওড়া হবে ৬০০px

---

*সেকশন ৮ — প্রিহেডার*

✅ ২৯. <body>-র পরপরই hidden preheader যোগ করো

---

*সেকশন ৯ — Footer-এ যা থাকতে হবে*

✅ কোম্পানির আইনি নাম
✅ অফিসের ঠিকানা
✅ যোগাযোগের ইমেইল
✅ Unsubscribe লিংক (কার্যকর)
✅ কেন এই মেইল পাচ্ছে তার কারণ
✅ Copyright লাইন

---

*সেকশন ১০ — চূড়ান্ত চেকলিস্ট*

☐ DOCTYPE আছে
☐ ৫টা meta tag আছে
☐ Title tag অর্থপূর্ণ
☐ MSO Outlook comment আছে
☐ From name আর domain একই ব্র্যান্ডের
☐ সব লিংক একই ডোমেইনে
☐ .top/.xyz ট্র্যাকিং ডোমেইন নেই
☐ কোনো {{অপূর্ণ}} variable নেই
☐ Unsubscribe লিংক কাজ করছে
☐ মাত্র ১টা ট্র্যাকিং পিক্সেল আছে
☐ পিক্সেল নিজের ডোমেইন থেকে
☐ Body-তে ALL CAPS নেই
☐ ফোন নম্বরে highlight নেই
☐ ফোন নম্বর H1/H2-তে নেই
☐ ভয় দেখানো ভাষা নেই
☐ ৬০%+ আসল টেক্সট আছে
☐ Subject-এ spam শব্দ নেই
☐ Footer-এ ঠিকানা আছে
☐ Footer-এ "কেন পাচ্ছো" লাইন আছে
☐ Table-এ role="presentation" আছে
☐ কোনো <script> <iframe> <form> নেই
☐ সব ছবিতে alt + width + height আছে
☐ সর্বোচ্চ ৬০০px container
☐ Preheader যোগ করা আছে
`;

const rule3English = `# 📬 How to Send 50,000 Emails/Day — Straight to Inbox

---

## 1. BATCH SCHEDULE — 50,000/Day

Split into 10 batches across the day. Never dump everything at once.

> 🇮🇳 All times below are **India IST** — this targets USA business hours (EST/PST)

| IST Time | USA EST | USA PST | Batch | Emails |
|---|---|---|---|---|
| 6:30 PM | 8:00 AM | 5:00 AM | Batch 1 | 5,000 |
| 7:30 PM | 9:00 AM | 6:00 AM | Batch 2 | 5,000 |
| 8:30 PM | 10:00 AM | 7:00 AM | Batch 3 | 5,000 |
| 9:30 PM | 11:00 AM | 8:00 AM | Batch 4 | 5,000 |
| 10:30 PM | 12:00 PM | 9:00 AM | Batch 5 | 5,000 |
| 11:30 PM | 1:00 PM | 10:00 AM | Batch 6 | 5,000 |
| 12:30 AM | 2:00 PM | 11:00 AM | Batch 7 | 5,000 |
| 1:30 AM | 3:00 PM | 12:00 PM | Batch 8 | 5,000 |
| 2:30 AM | 4:00 PM | 1:00 PM | Batch 9 | 5,000 |
| 3:30 AM | 5:00 PM | 2:00 PM | Batch 10 | 5,000 |

- ✅ Max **5,000 per batch**
- ✅ Minimum **60 minutes gap** between each batch
- ✅ Send Sunday night IST to Friday morning IST (covers Mon–Fri USA)
- ❌ Never send before 6:30 PM IST (too early for USA East Coast)

---

## 2. SPLIT BY EMAIL PROVIDER

Never send all emails to Gmail at the same time. Distribute like this:

| Provider | % of List | Daily Volume | Max Per Batch |
|---|---|---|---|
| Gmail | ~40% | ~20,000 | 2,000 |
| Outlook / Hotmail | ~25% | ~12,500 | 1,250 |
| Yahoo | ~15% | ~7,500 | 750 |
| Others | ~20% | ~10,000 | 1,000 |

> Mix providers inside each batch — don't do a full Gmail batch then a full Yahoo batch.

---

## 3. BEST SENDING TIMES

| IST Time | USA Time | Best For |
|---|---|---|
| 6:30 PM – 8:30 PM IST | 8 AM – 10 AM EST | Transactional emails, invoices |
| 8:30 PM – 10:30 PM IST | 10 AM – 12 PM EST | Newsletters, promotions |
| 10:30 PM – 12:30 AM IST | 12 PM – 2 PM EST | Follow-ups, reminders |
| 12:30 AM – 2:30 AM IST | 2 PM – 4 PM EST | Offers, updates |

---

## 4. LIST RULES — Keep It Clean

| Action | When |
|---|---|
| Remove hard bounces | After every send — same day |
| Remove spam complainers | Immediately and permanently |
| Verify full list | Every 3 months (use ZeroBounce / NeverBounce) |
| Remove no-opens | Anyone who hasn't opened in 90+ days |

> Bounce rate must stay **below 2%**
> Complaint rate must stay **below 0.08%**
> Breaking these = ESP suspends your account

---

## 5. DAILY METRICS TO CHECK

Open your ESP dashboard every morning and check:

| Metric | Safe | Stop Sending If |
|---|---|---|
| Bounce Rate | < 2% | > 3% |
| Complaint Rate | < 0.08% | > 0.1% |
| Open Rate | > 15% | Drops 40% suddenly |
| IP Blacklisted | Not listed | Listed anywhere |

**Free tools to monitor:**
- Google Postmaster Tools — domain & IP reputation
- MXToolbox.com — blacklist check
- dmarcian.com — DMARC reports

---

## 6. IF SOMETHING GOES WRONG

If bounce or complaint rate spikes:

1. **Stop sending immediately**
2. Clean your list — remove all bounces and complainers
3. Wait 24 hours
4. Restart at half your last volume
5. Ramp back to 50,000 over 3 days

---

## ✅ Daily Send Checklist

\`\`\`
☐ Bounce rate checked — below 2%
☐ Complaint rate checked — below 0.08%
☐ IP not blacklisted (mxtoolbox.com)
☐ Sending in batches of 5,000 max
☐ 60 min gap between every batch
☐ Providers mixed inside each batch
☐ Sending between 6:30 PM – 3:30 AM IST only
☐ Hard bounces from yesterday removed
\`\`\`

---

_Follow this every day and your emails will land in inbox consistently._
`;

const rule3Bengali = `# 📬 প্রতিদিন ৫০,০০০ ইমেইল পাঠানোর নিয়ম — সরাসরি Inbox-এ

---

## ১. ব্যাচ শিডিউল — প্রতিদিন ৫০,০০০ ইমেইল

একসাথে সব পাঠাবে না। ১০টা ভাগে ভাগ করে পাঠাও।

> 🇮🇳 নিচের সব সময় **ভারতীয় IST অনুযায়ী** — এটা আমেরিকার অফিস সময় (EST/PST) টার্গেট করে

| IST সময় | USA EST | USA PST | ব্যাচ | ইমেইল |
|---|---|---|---|---|
| রাত ৬:৩০ | সকাল ৮:০০ | সকাল ৫:০০ | ব্যাচ ১ | ৫,০০০ |
| রাত ৭:৩০ | সকাল ৯:০০ | সকাল ৬:০০ | ব্যাচ ২ | ৫,০০০ |
| রাত ৮:৩০ | সকাল ১০:০০ | সকাল ৭:০০ | ব্যাচ ৩ | ৫,০০০ |
| রাত ৯:৩০ | সকাল ১১:০০ | সকাল ৮:০০ | ব্যাচ ৪ | ৫,০০০ |
| রাত ১০:৩০ | দুপুর ১২:০০ | সকাল ৯:০০ | ব্যাচ ৫ | ৫,০০০ |
| রাত ১১:৩০ | দুপুর ১:০০ | সকাল ১০:০০ | ব্যাচ ৬ | ৫,০০০ |
| রাত ১২:৩০ | দুপুর ২:০০ | সকাল ১১:০০ | ব্যাচ ৭ | ৫,০০০ |
| রাত ১:৩০ | বিকাল ৩:০০ | দুপুর ১২:০০ | ব্যাচ ৮ | ৫,০০০ |
| রাত ২:৩০ | বিকাল ৪:০০ | দুপুর ১:০০ | ব্যাচ ৯ | ৫,০০০ |
| রাত ৩:৩০ | বিকাল ৫:০০ | দুপুর ২:০০ | ব্যাচ ১০ | ৫,০০০ |

- ✅ এক ব্যাচে সর্বোচ্চ **৫,০০০ ইমেইল**
- ✅ প্রতিটা ব্যাচের মাঝে কমপক্ষে **৬০ মিনিট বিরতি**
- ✅ রবিবার রাত IST থেকে শুক্রবার সকাল IST পর্যন্ত পাঠাও (আমেরিকার সোম–শুক্র কভার হবে)
- ❌ সন্ধ্যা ৬:৩০-এর আগে পাঠাবে না (USA East Coast-এর জন্য তখন অনেক সকাল)

---

## ২. Email Provider অনুযায়ী ভাগ করো

একসাথে সব Gmail-এ পাঠাবে না। এভাবে ভাগ করো:

| Provider | লিস্টের % | প্রতিদিন | প্রতি ব্যাচে সর্বোচ্চ |
|---|---|---|---|
| Gmail | ~৪০% | ~২০,০০০ | ২,০০০ |
| Outlook / Hotmail | ~২৫% | ~১২,৫০০ | ১,২৫০ |
| Yahoo | ~১৫% | ~৭,৫০০ | ৭৫০ |
| অন্যান্য | ~২০% | ~১০,০০০ | ১,০০০ |

> প্রতিটা ব্যাচে সব provider মিশিয়ে রাখো — আলাদা আলাদা করে পাঠালে স্প্যাম হবে।

---

## ৩. সেরা সময় কোনটা

| IST সময় | USA সময় | কোন ধরনের মেইলের জন্য |
|---|---|---|
| রাত ৬:৩০ – ৮:৩০ IST | সকাল ৮ – ১০ EST | Invoice, লেনদেন সংক্রান্ত মেইল |
| রাত ৮:৩০ – ১০:৩০ IST | সকাল ১০ – দুপুর ১২ EST | Newsletter, প্রমোশন |
| রাত ১০:৩০ – ১২:৩০ IST | দুপুর ১২ – ২ EST | Follow-up, Reminder |
| রাত ১২:৩০ – ২:৩০ IST | বিকাল ২ – ৪ EST | অফার, আপডেট |

---

## ৪. লিস্ট পরিষ্কার রাখার নিয়ম

| কাজ | কখন করবে |
|---|---|
| Hard bounce সরিয়ে দাও | প্রতিটা সেন্ডের পরে — একই দিনে |
| স্প্যাম complainer সরিয়ে দাও | সাথে সাথে এবং চিরতরে |
| পুরো লিস্ট verify করো | প্রতি ৩ মাসে (ZeroBounce / NeverBounce দিয়ে) |
| যারা খোলেনি তাদের সরাও | ৯০ দিনেও যারা একটাও মেইল খোলেনি |

> Bounce rate অবশ্যই **২%-এর নিচে** রাখতে হবে
> Complaint rate অবশ্যই **০.০৮%-এর নিচে** রাখতে হবে
> এই সীমা পার হলে ESP তোমার অ্যাকাউন্ট বন্ধ করে দেবে

---

## ৫. প্রতিদিন যে Metrics চেক করতে হবে

প্রতিদিন সকালে ESP dashboard খুলে এগুলো দেখো:

| Metric | নিরাপদ সীমা | এই সীমা পার হলে বন্ধ করো |
|---|---|---|
| Bounce Rate | ২%-এর নিচে | ৩%-এর বেশি |
| Complaint Rate | ০.০৮%-এর নিচে | ০.১%-এর বেশি |
| Open Rate | ১৫%-এর বেশি | হঠাৎ ৪০% কমে গেলে |
| IP Blacklisted | কোনো লিস্টে নেই | যেকোনো লিস্টে উঠলে |

**ফ্রি টুলস যেগুলো ব্যবহার করবে:**
- Google Postmaster Tools — domain ও IP reputation দেখার জন্য
- MXToolbox.com — blacklist চেক করার জন্য
- dmarcian.com — DMARC রিপোর্ট দেখার জন্য

---

## ৬. সমস্যা হলে কী করবে

Bounce বা Complaint rate হঠাৎ বেড়ে গেলে:

1. **সাথে সাথে পাঠানো বন্ধ করো**
2. লিস্ট পরিষ্কার করো — সব bounce আর complainer সরাও
3. ২৪ ঘণ্টা অপেক্ষা করো
4. আগের volume-এর অর্ধেক দিয়ে আবার শুরু করো
5. ৩ দিনে ধীরে ধীরে ৫০,০০০-এ ফিরে আসো

---

## ✅ প্রতিদিনের চেকলিস্ট

\`\`\`
☐ Bounce rate চেক — ২%-এর নিচে আছে
☐ Complaint rate চেক — ০.০৮%-এর নিচে আছে
☐ IP blacklist চেক (mxtoolbox.com)
☐ প্রতি ব্যাচে সর্বোচ্চ ৫,০০০ ইমেইল
☐ প্রতিটা ব্যাচের মাঝে ৬০ মিনিট বিরতি
☐ প্রতিটা ব্যাচে সব provider মেশানো আছে
☐ রাত ৬:৩০ – ভোর ৩:৩০ IST-এর মধ্যে পাঠানো হচ্ছে
☐ গতকালের hard bounce লিস্ট থেকে সরানো হয়েছে
\`\`\`

---

_প্রতিদিন এই নিয়ম মেনে চললে তোমার মেইল সবসময় Inbox-এ যাবে।_
`;

const rule4English = `# 🌐 Domain Buying Guide for Email Sending

---

## 1. BUY THE RIGHT DOMAIN

### Where to Buy
| Registrar | Link | Cost/Year |
|---|---|---|
| Namecheap | https://www.namecheap.com | ~$10–15 |
| GoDaddy | https://www.godaddy.com | ~$12–20 |
| Cloudflare | https://www.cloudflare.com/products/registrar | ~$9 (at cost) |
| Google Domains | https://domains.google | ~$12 |

### Rules for Picking a Domain
- ✅ Use a **subdomain for sending** — never your main domain
  - Main domain: \`yourcompany.com\` (website, personal email)
  - Sending domain: \`mail.yourcompany.com\` or \`send.yourcompany.com\`
- ✅ Pick \`.com\` only — \`.net\`, \`.org\` are okay but \`.com\` has the best reputation
- ❌ Never use \`.top\` \`.xyz\` \`.click\` \`.online\` — spam filters hate these
- ❌ Never buy a used/expired domain — it may carry bad reputation already
- ✅ Buy a **brand new, never registered** domain only

### Check if a Domain Was Ever Blacklisted Before Buying
Paste the domain here before purchasing:
- https://mxtoolbox.com/blacklists.aspx
- https://www.spamhaus.org/lookup/

---

## 2. SET UP DNS RECORDS

After buying, log into your registrar's DNS panel and add these 4 records:

### SPF Record
\`\`\`
Type: TXT
Host: @ (or your sending subdomain e.g. mail)
Value: v=spf1 include:spf.brevo.com ~all
\`\`\`
*(Replace with Brevo's SPF value)*

### DKIM Record
\`\`\`
Type: TXT
Host: (given by your ESP — usually something like selector._domainkey)
Value: (long key given by your ESP dashboard)
\`\`\`
Generate DKIM from your ESP dashboard — copy and paste exactly.

### DMARC Record
\`\`\`
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:reports@yourdomain.com
\`\`\`

### Custom Tracking Domain (for open/click tracking)
\`\`\`
Type: CNAME
Host: track (creates track.yourdomain.com)
Value: (given by your ESP — e.g. sendgrid.net or brevo.com)
\`\`\`

---

## 3. VALIDATE YOUR DNS SETUP

After adding DNS records, wait 10–30 minutes then check:

| What to Check | Tool | Link |
|---|---|---|
| SPF record | MXToolbox SPF Checker | https://mxtoolbox.com/spf.aspx |
| DKIM record | MXToolbox DKIM Checker | https://mxtoolbox.com/dkim.aspx |
| DMARC record | MXToolbox DMARC Checker | https://mxtoolbox.com/dmarc.aspx |
| All DNS at once | Mail Tester | https://www.mail-tester.com |
| Full email test | GlockApps | https://glockapps.com |
| Blacklist check | MXToolbox Blacklist | https://mxtoolbox.com/blacklists.aspx |

> ✅ All checks must show **green / pass** before you send a single email.

---

## 4. TEST YOUR DOMAIN REPUTATION

Before going live, send a test email and check your score:

| Tool | What it Does | Link |
|---|---|---|
| **Mail Tester** | Gives your email a score out of 10 | https://www.mail-tester.com |
| **GlockApps** | Shows inbox/spam placement per provider | https://glockapps.com |
| **Postmaster Tools** | Google's own domain reputation tracker | https://postmaster.google.com |
| **SNDS** | Microsoft's sender reputation tool | https://sendersupport.olc.protection.outlook.com/snds |

> 🎯 Target: **9.5/10 or higher** on Mail Tester before going full volume.

---

## 5. ONGOING DOMAIN MONITORING

Set these up and check weekly:

| Tool | Purpose | Link |
|---|---|---|
| Google Postmaster Tools | Domain & IP reputation from Gmail | https://postmaster.google.com |
| MXToolbox Monitor | Alerts if your domain gets blacklisted | https://mxtoolbox.com/monitoring |
| dmarcian | DMARC report analysis | https://dmarcian.com |
| Hetrix Tools | Blacklist monitoring (free tier) | https://hetrixtools.com |

---

## 6. QUICK CHECKLIST

\`\`\`
☐ Bought brand new .com domain
☐ Domain checked — not blacklisted before buying
☐ Sending subdomain created (mail.yourdomain.com)
☐ SPF record added and validated ✅
☐ DKIM record added and validated ✅
☐ DMARC record added and validated ✅
☐ Custom tracking CNAME added
☐ Mail Tester score = 9.5/10 or above
☐ Google Postmaster Tools set up
☐ MXToolbox blacklist monitoring enabled
\`\`\`

---

_Do all of this before sending your first email. A clean domain = inbox delivery._
`;

const rule4Bengali = `# 🌐 ইমেইল পাঠানোর জন্য ডোমেইন কেনার গাইড

---

## ১. সঠিক ডোমেইন কিনো

### কোথায় কিনবে
| রেজিস্ট্রার | লিংক | মূল্য/বছর |
|---|---|---|
| Namecheap | https://www.namecheap.com | ~$১০–১৫ |
| GoDaddy | https://www.godaddy.com | ~$১২–২০ |
| Cloudflare | https://www.cloudflare.com/products/registrar | ~$৯ (at cost) |
| Google Domains | https://domains.google | ~$১২ |

### ডোমেইন বাছাইয়ের নিয়ম
- ✅ মূল ডোমেইন ব্যবহার না করে **সাবডোমেইন ব্যবহার করো**
  - মূল ডোমেইন: \`yourcompany.com\` (ওয়েবসাইট, ব্যক্তিগত ইমেইল)
  - সেন্ডিং ডোমেইন: \`mail.yourcompany.com\` বা \`send.yourcompany.com\`
- ✅ শুধু \`.com\` কিনো — \`.net\`, \`.org\` চলবে কিন্তু \`.com\\)-এর রেপুটেশন সবচেয়ে ভালো
- ❌ \`.top\` \`.xyz\` \`.click\` \`.online\` কখনো ব্যবহার করবে না — স্প্যাম ফিল্টার এগুলো পছন্দ করে না
- ❌ কখনো ব্যবহার করা/মেয়াদোত্তীর্ণ ডোমেইন কিনবে না — এর সাথে খারাপ রেপুটেশন থাকতে পারে
- ✅ শুধু **ব্র্যান্ড নতুন, কখনো রেজিস্টার করা হয়নি** এমন ডোমেইন কিনো

### কেনার আগে ব্ল্যাকলিস্ট চেক করো
কেনার আগে এই টুলসে ডোমেইন পেস্ট করো:
- https://mxtoolbox.com/blacklists.aspx
- https://www.spamhaus.org/lookup/

---

## ২. DNS রেকর্ড সেটআপ করো

ডোমেইন কেনার পর DNS প্যানেলে গিয়ে এই ৪টা রেকর্ড যোগ করো:

### SPF Record
\`\`\`
Type: TXT
Host: @ (বা তোমার সেন্ডিং সাবডোমেইন যেমন mail)
Value: v=spf1 include:spf.brevo.com ~all
\`\`\`
*(তোমার ESP অনুযায়ী \`spf.brevo.com\` পরিবর্তন করো)*

### DKIM Record
\`\`\`
Type: TXT
Host: (ESP দেবে — সাধারণত selector._domainkey)
Value: (ESP ড্যাশবোর্ডের লম্বা কীটা কপি করে দাও)
\`\`\`
ESP ড্যাশবোর্ড থেকে DKIM জেনারেট করে নাও — হুবহু কপি করো।

### DMARC Record
\`\`\`
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:reports@yourdomain.com
\`\`\`

### Custom Tracking Domain (open/click ট্র্যাকিংয়ের জন্য)
\`\`\`
Type: CNAME
Host: track (এতে track.yourdomain.com তৈরি হবে)
Value: (ESP দেবে — যেমন sendgrid.net বা brevo.com)
\`\`\`

---

## ৩. DNS সেটআপ ভেরিফাই করো

DNS রেকর্ড যোগ করার পর ১০–৩০ মিনিট অপেক্ষা করে চেক করো:

| কী চেক করবে | টুল | লিংক |
|---|---|---|
| SPF রেকর্ড | MXToolbox SPF Checker | https://mxtoolbox.com/spf.aspx |
| DKIM রেকর্ড | MXToolbox DKIM Checker | https://mxtoolbox.com/dkim.aspx |
| DMARC রেকর্ড | MXToolbox DMARC Checker | https://mxtoolbox.com/dmarc.aspx |
| সব DNS একসাথে | Mail Tester | https://www.mail-tester.com |
| সম্পূর্ণ ইমেইল টেস্ট | GlockApps | https://glockapps.com |
| ব্ল্যাকলিস্ট চেক | MXToolbox Blacklist | https://mxtoolbox.com/blacklists.aspx |

> ✅ একটি মেইল পাঠানোর আগে সব চেকে **সবুজ / পাস** দেখাতে হবে।

---

## ৪. ডোমেইন রেপুটেশন টেস্ট করো

লাইভ যাওয়ার আগে একটি টেস্ট ইমেইল পাঠিয়ে স্কোর দেখো:

| টool | কী করে | লিংক |
|---|---|---|
| **Mail Tester** | ইমেইলকে ১০-এ কত দেয় তা দেখায় | https://www.mail-tester.com |
| **GlockApps** | প্রতি প্রোভাইডারে ইনবক্স/স্প্যাম প্লেসমেন্ট দেখায় | https://glockapps.com |
| **Postmaster Tools** | Google-এর নিজস্ব ডোমেইন রেপুটেশন ট্র্যাকার | https://postmaster.google.com |
| **SNDS** | Microsoft-এর সেন্ডার রেপুটেশন টুল | https://sendersupport.olc.protection.outlook.com/snds |

> 🎯 লক্ষ্য: পুরো ভলিউমে যাওয়ার আগে Mail Tester-এ **৯.৫/১০ বা তার বেশি** স্কোর আনো।

---

## ৫. নিয়মিত ডোমেইন মনিটরিং

এগুলো সেটআপ করে সাপ্তাহিক চেক করো:

| টool | উদ্দেশ্য | লিংক |
|---|---|---|
| Google Postmaster Tools | Gmail-এ ডোমেইন ও IP রেপুটেশন | https://postmaster.google.com |
| MXToolbox Monitor | ডোমেইন ব্ল্যাকলিস্টেড হলে সতর্কতা | https://mxtoolbox.com/monitoring |
| dmarcian | DMARC রিপোর্ট বিশ্লেষণ | https://dmarcian.com |
| Hetrix Tools | ব্ল্যাকলিস্ট মনিটরিং (ফ্রি টিয়ার) | https://hetrixtools.com |

---

## ৬. দ্রুত চেকলিস্ট

\`\`\`
☐ ব্র্যান্ড নতুন .com ডোমেইন কেনা হয়েছে
☐ কেনার আগে ব্ল্যাকলিস্ট চেক করা হয়েছে
☐ সেন্ডিং সাবডোমেইন তৈরি করা হয়েছে (mail.yourdomain.com)
☐ SPF রেকর্ড যোগ ও ভেরিফাই করা হয়েছে ✅
☐ DKIM রেকর্ড যোগ ও ভেরিফাই করা হয়েছে ✅
☐ DMARC রেকর্ড যোগ ও ভেরিফাই করা হয়েছে ✅
☐ Custom tracking CNAME যোগ করা হয়েছে
☐ Mail Tester স্কোর = ৯.৫/১০ বা তার বেশি
☐ Google Postmaster Tools সেটআপ করা হয়েছে
☐ MXToolbox ব্ল্যাকলিস্ট মনিটরিং চালু করা হয়েছে
\`\`\`

---

_প্রথম ইমেইল পাঠানোর আগে সবকিছু ঠিকঠাক করো। একটি পরিষ্কার ডোমেইন = ইনবক্স ডেলিভারি।_
`;

const exampleHtml = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>Invoice DER-TYI-548 – TFN Technologies</title>

  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->

  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f0f2f5; }

    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .fluid { width: 100% !important; max-width: 100% !important; }
      .stack-column, .stack-column-center { display: block !important; width: 100% !important; }
      .stack-column-center { text-align: center !important; }
      .mobile-padding { padding: 16px !important; }
      .mobile-center { text-align: center !important; }
      .mobile-font { font-size: 14px !important; }
      .hide-mobile { display: none !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f0f2f5; font-family: Arial, Helvetica, sans-serif;">

<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
  Your invoice #DER-TYI-548 from TFN Technologies — Total: $699.99.
  &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f0f2f5;">
  <tr>
    <td align="center" style="padding: 24px 12px;">

      <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden;">

        <tr>
          <td style="background-color:#003399; padding: 28px 32px; text-align:center;">
            <h1 style="margin:0; font-size:26px; font-weight:700; color:#ffffff;">TFN Technologies</h1>
            <p style="margin:6px 0 0; font-size:14px; color:#c8d6ff;">billing@tfntechnologies.com</p>
          </td>
        </tr>

        <tr>
          <td style="padding: 28px 32px 0; text-align:right;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="right">
              <tr>
                <td style="background-color:#f0f4ff; border-left: 4px solid #003399; padding: 14px 20px; border-radius: 4px;">
                  <p style="margin:0; font-size:22px; font-weight:700; color:#003399; text-transform:uppercase;">Invoice</p>
                  <p style="margin:6px 0 0; font-size:13px; color:#555;"><strong>Invoice No:</strong> DER-TYI-548</p>
                  <p style="margin:4px 0 0; font-size:13px; color:#555;"><strong>Date:</strong> June 8, 2026</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 24px 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td class="stack-column" valign="top" width="50%" style="padding-right:12px;">
                  <p style="margin:0 0 6px; font-size:11px; font-weight:700; text-transform:uppercase; color:#003399;">Bill To</p>
                  <p style="margin:0; font-size:14px; color:#333; line-height:1.7;">
                    Dear Valued Customer<br>
                    <strong>Order No:</strong> 06235647<br>
                    <strong>Payment Method:</strong> Credit Card<br>
                    <strong>Order Date:</strong> May 19, 2026
                  </p>
                </td>
                <td class="stack-column" valign="top" width="50%" style="padding-left:12px;">
                  <p style="margin:0 0 6px; font-size:11px; font-weight:700; text-transform:uppercase; color:#003399;">Delivery Details</p>
                  <p style="margin:0; font-size:14px; color:#333; line-height:1.7;">
                    <strong>Method:</strong> Online Delivery<br>
                    <strong>Transaction ID:</strong> T6618JXU3666<br>
                    <strong>Amount:</strong> $699.99
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 0 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="border-top: 1px solid #e5e9f0; font-size:0; line-height:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 24px 32px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse; font-size:14px;">
              <tr style="background-color:#003399;">
                <td style="padding:10px 14px; color:#fff; font-weight:700; width:42%;">Description</td>
                <td style="padding:10px 14px; color:#fff; font-weight:700; text-align:center; width:13%;">Qty</td>
                <td style="padding:10px 14px; color:#fff; font-weight:700; text-align:right; width:22%;">Unit Price</td>
                <td style="padding:10px 14px; color:#fff; font-weight:700; text-align:right; width:23%;">Total</td>
              </tr>
              <tr style="background-color:#f7f9fc;">
                <td style="padding:12px 14px; color:#333; border-bottom:1px solid #e5e9f0;">BTC Purchase</td>
                <td style="padding:12px 14px; color:#333; text-align:center; border-bottom:1px solid #e5e9f0;">1</td>
                <td style="padding:12px 14px; color:#333; text-align:right; border-bottom:1px solid #e5e9f0;">$699.99</td>
                <td style="padding:12px 14px; color:#333; text-align:right; border-bottom:1px solid #e5e9f0;">$699.99</td>
              </tr>
              <tr>
                <td style="padding:12px 14px; color:#333; border-bottom:1px solid #e5e9f0;">Setup &amp; Provisioning Fee</td>
                <td style="padding:12px 14px; color:#777; text-align:center; border-bottom:1px solid #e5e9f0;">—</td>
                <td style="padding:12px 14px; color:#777; text-align:right; border-bottom:1px solid #e5e9f0;">$0.00</td>
                <td style="padding:12px 14px; color:#777; text-align:right; border-bottom:1px solid #e5e9f0;">$0.00</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 0 32px 24px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="right" style="font-size:14px; min-width:220px;">
              <tr>
                <td style="padding:8px 14px; color:#555;">Subtotal</td>
                <td style="padding:8px 14px; color:#333; text-align:right;">$699.99</td>
              </tr>
              <tr>
                <td style="padding:8px 14px; color:#555;">Tax (0%)</td>
                <td style="padding:8px 14px; color:#333; text-align:right;">$0.00</td>
              </tr>
              <tr style="background-color:#003399;">
                <td style="padding:12px 14px; color:#fff; font-weight:700; font-size:15px; border-radius:4px 0 0 4px;">Total Due</td>
                <td style="padding:12px 14px; color:#fff; font-weight:700; font-size:15px; text-align:right; border-radius:0 4px 4px 0;">$699.99</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 0 32px 28px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="background-color:#fff8e6; border:1px solid #ffe0a0; border-radius:6px; padding:16px 20px;">
                  <p style="margin:0 0 6px; font-size:13px; font-weight:700; color:#7a5c00;">Did not authorize this transaction?</p>
                  <p style="margin:0; font-size:13px; color:#555; line-height:1.6;">
                    Contact us at <a href="mailto:billing@tfntechnologies.com" style="color:#003399; font-weight:700;">billing@tfntechnologies.com</a>
                    or call <a href="tel:+18283467495" style="color:#003399; font-weight:700;">+1 (828) 346-7495</a>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background-color:#f7f9fc; padding: 24px 32px; text-align:center;">
            <p style="margin:0 0 6px; font-size:13px; font-weight:700; color:#333;">TFN Technologies, Inc.</p>
            <p style="margin:0 0 12px; font-size:12px; color:#777; line-height:1.6;">
              123 Business Avenue, Suite 400, New York, NY 10001, USA<br>
              <a href="mailto:billing@tfntechnologies.com" style="color:#003399;">billing@tfntechnologies.com</a>
            </p>
            <p style="margin:0; font-size:11px; color:#aaa; line-height:1.6;">
              You are receiving this email because you have a transaction with TFN Technologies.<br>
              <a href="https://tfntechnologies.com/unsubscribe?uid=%%RECIPIENT_ID%%&email=%%EMAIL%%" style="color:#aaa; text-decoration:underline;">Unsubscribe</a>
            </p>
            <p style="margin:10px 0 0; font-size:11px; color:#ccc;">&copy; 2026 TFN Technologies, Inc. All rights reserved.</p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;

export default function RulesView({ showToast }) {
  const [lang, setLang] = useState('en');
  const [expanded, setExpanded] = useState(null);

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast?.(`${label} copied to clipboard.`);
    } catch {
      showToast?.('Failed to copy.', 'error');
    }
  };

  const rules = [
    {
      id: 1,
      title: 'Email HTML Deliverability Rules',
      badge: 'EN / BN',
      content: lang === 'en' ? englishRules : bengaliRules,
      copyLabel: 'Rules'
    },
    {
      id: 2,
      title: 'Example — Compliant Invoice HTML',
      badge: 'Template',
      content: exampleHtml,
      copyLabel: 'HTML template'
    },
    {
      id: 3,
      title: 'Email Sending Tips to Avoid Spam',
      badge: 'EN / BN',
      content: lang === 'en' ? rule3English : rule3Bengali,
      copyLabel: 'Sending tips'
    },
    {
      id: 4,
      title: 'What Domain to Buy',
      badge: 'EN / BN',
      content: lang === 'en' ? rule4English : rule4Bengali,
      copyLabel: 'Domain guide'
    }
  ];

  return (
    <div className="max-w-[1000px] p-14">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Email Deliverability Rules</h1>
      </div>
      <p className="text-sm text-fg-muted mb-8">
        Reference rules for email HTML formatting, deliverability, and compliance.
      </p>

      <div className="space-y-5">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="bg-surface-raised rounded-2xl border border-border-light overflow-hidden"
          >
            <div
              className="flex items-center justify-between px-6 py-4 cursor-pointer select-none hover:bg-surface-secondary/50 transition-colors"
              onClick={() => setExpanded(expanded === rule.id ? null : rule.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${rule.content
                    ? 'bg-accent text-white'
                    : 'bg-accent-muted text-fg-muted'
                  }`}>
                  {rule.id}
                </div>
                <div>
                  <div className="text-sm font-semibold text-fg">{rule.title}</div>
                  <div className={`text-[11px] font-medium mt-0.5 ${rule.badge === 'Coming Soon' ? 'text-fg-muted' : 'text-brand-orange'
                    }`}>
                    {rule.badge}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {(rule.id === 1 || rule.id === 3 || rule.id === 4) && rule.content && (
                  <div className="flex bg-surface-secondary rounded-full p-0.5 border border-border-light mr-2">
                    <button
                      onClick={() => setLang('en')}
                      className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${lang === 'en' ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg'
                        }`}
                      type="button"
                    >
                      EN
                    </button>
                    <button
                      onClick={() => setLang('bn')}
                      className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${lang === 'bn' ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg'
                        }`}
                      type="button"
                    >
                      BN
                    </button>
                  </div>
                )}

                {rule.content && (
                  <button
                    onClick={() => copyToClipboard(rule.content, rule.copyLabel)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full bg-surface-secondary hover:bg-accent hover:text-white transition-all cursor-pointer border border-border-light"
                    type="button"
                    title={`Copy ${rule.copyLabel}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </button>
                )}

                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  className={`text-fg-muted transition-transform duration-200 ${expanded === rule.id ? 'rotate-180' : ''
                    }`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {expanded === rule.id && (
              <div className="border-t border-border-light">
                {rule.content ? (
                  <div className="p-6 max-h-[600px] overflow-y-auto bg-white markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {rule.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-accent-muted flex items-center justify-center mx-auto mb-3">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-muted">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-fg-muted">{rule.placeholder}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}