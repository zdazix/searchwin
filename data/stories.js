// Success stories (/blog/success-stories/). One object per story; scripts/build-site.mjs writes a page for each
// from the same template, built to move a reader to the next step.
//
// PUBLISH ONLY WHAT IS TRUE. A story goes live only when the client has approved its name, its words and
// every number. Until then keep `draft: true`: the page is built, so you can read it at its address, but it is
// not listed anywhere, not in the sitemap, and it tells search engines not to index it.
// "Success stories" appears in the site nav and footer on its own, with the first story that is not a draft.
//
// Fields:
//   slug         the address: /blog/success-stories/{slug}/
//   draft        true: built but hidden (see above)
//   sample       true: shows the "sample story" banner. Only for the layout sample below
//   date         when it was published, 2026-11-14
//   title        the outcome first, then who: "From … to …: a dental clinic in Austin"
//   description  one or two sentences under the title; also the search result and the social card
//   client       name, industry, location, size (shown in "At a glance")
//   audience     local | national: picks the starting price shown under the story
//   solutions    ids from data/solutions.js; the first is the one the story sends readers to
//   period       how long the work ran
//   engines      which AI engines were checked
//   metrics      three results for the top of the page: value, unit (optional), label
//   quote        the client's own words: text, name, role
//   challenge    the situation before, as Markdown
//   work         what was shipped, as a counted list; workIntro (optional) is a sentence above it
//   results      intro (Markdown), rows (the same questions before and after), leads (numbers with labels),
//                source (where the numbers come from and for which period)
//   takeaways    three things that made the difference: title, text
//   fit          "this story is close to yours if…": three or four short lines

export const STORIES = [
  {
    slug: 'sample-dental-clinic',
    draft: true,
    sample: true,
    date: '2026-11-14',
    title: 'From “not mentioned” to 14 enquiries a month: a dental clinic in Austin',
    description: 'A two-dentist clinic was missing from every AI answer about implants in its city. After a 45-day sprint and three months of monthly work, AI names it on 7 of 10 buyer questions and the pages built for those questions bring 14 enquiries a month.',
    client: { name: 'Sample Dental Clinic', industry: 'Dental clinic', location: 'Austin, TX', size: '2 dentists, 1 location' },
    audience: 'local',
    solutions: ['sprint', 'monthly'],
    period: '45-day sprint, then 3 months of monthly work',
    engines: 'ChatGPT, Gemini, Google AI Overviews',
    metrics: [
      { value: '2 → 7', unit: 'of 10', label: 'buyer questions where AI names the clinic' },
      { value: '#4 → #1', label: 'best position in an AI answer' },
      { value: '14', unit: 'a month', label: 'enquiries from AI search and Google by month 3' }
    ],
    quote: {
      text: 'We used to hear “I found you on Google”. Now new patients tell us ChatGPT sent them, and they already know what implants cost with us before they call.',
      name: 'Clinic owner',
      role: 'Sample Dental Clinic'
    },
    challenge: `
The clinic had good reviews and a steady flow of regular patients, but almost no new enquiries for implants, its most valuable treatment. When we asked ChatGPT, Gemini and Google’s AI ten questions a patient would ask before choosing an implant dentist in Austin, the clinic was named in two answers and never above fourth place.

Three things were in the way:

- **One page for everything.** Implants, crowns and whitening shared a single “Services” page, so there was nothing for AI to quote on a specific question.
- **Facts that disagreed.** Opening hours and the phone number differed between the website, the Google Business Profile and two directories.
- **No next step.** The only way to make contact was a general form at the bottom of the homepage.
`,
    workIntro: 'Everything below was on the deliverables list the clinic signed off before day 1.',
    work: [
      'Website fixes: AI crawler access, schema for the clinic and its treatments, the same name, address and phone everywhere',
      'Google Business Profile fix-up: categories, services, hours, photos, Q&A',
      '3 new service pages: implants, crowns and emergency visits, each with a short answer up top, prices as ranges and a booking button',
      'An FAQ page rewritten around the questions patients ask AI',
      '5 directory and review-site listings set up or corrected',
      'A review routine: request templates, a QR card at reception, reply templates',
      'Click-to-call, a booking link and call and form tracking on every page',
      'In the monthly work: one new page a month (implant cost, implants vs bridges, a second location page) and four Google posts'
    ],
    results: {
      intro: 'On day 45 we asked the same ten questions on the same engines. The clinic was named in seven answers, and first in one of them. The enquiries followed over the next three months, as the new pages were picked up.',
      rows: [
        { question: 'best dentist in Austin for implants', engine: 'ChatGPT', before: 'Not mentioned', after: '#2' },
        { question: 'how much do dental implants cost in Austin', engine: 'Google AI Overviews', before: 'Not mentioned', after: '#1' },
        { question: 'emergency dentist in Austin open now', engine: 'Gemini', before: '#4', after: '#2' },
        { question: 'dental implants vs bridges', engine: 'ChatGPT', before: 'Not mentioned', after: 'Not mentioned' }
      ],
      leads: [
        { n: '9', label: 'calls' },
        { n: '3', label: 'booking requests' },
        { n: '2', label: 'contact forms' }
      ],
      source: 'Enquiries in month 3 from AI search and Google, counted with call and form tracking in GA4. Not every question moved: the comparison question is next on the list.'
    },
    takeaways: [
      { title: 'A page per buying question', text: 'The implant cost page answered a question the clinic used to answer only on the phone. It is now the page most enquiries come from.' },
      { title: 'The same facts everywhere', text: 'Once the hours and phone number matched across the site, the profile and the directories, AI stopped hedging about whether the clinic was open.' },
      { title: 'A next step on every page', text: 'Each new page ends in a booking button and a phone number, so a patient who arrives from an AI answer does not have to look for one.' }
    ],
    fit: [
      'You are a clinic, practice or service business with one or two locations',
      'People search and ask AI for what you do, but your name rarely comes up',
      'Your services share one page, or your pages have no clear way to book or call',
      'You want to count enquiries, not visits'
    ]
  }
];
