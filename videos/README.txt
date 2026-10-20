TrybeMarket instructional videos (Remotion)
===========================================

Short vertical (1080x1920) videos, written in React and rendered to MP4 on
your machine. This folder is NOT part of the website build (.vercelignore
skips it, and it has its own package.json and node_modules).

Images come straight from the website's public/ folder (remotion.config.js),
so the videos show the same logo and example screenshots as the app.

Setup (once):       cd videos && npm install
Preview and edit:   npm run studio          (opens Remotion Studio in the browser)
Render the MP4:     npm run render:kyc      -> videos/out/kyc-walkthrough.mp4
One frame as PNG:   npx remotion still src/index.js KycWalkthrough out/frame.png --frame=300

Videos
  KycWalkthrough   src/KycWalkthrough.jsx (timeline and captions)
                   src/screens.jsx (the /kyc screens, taps and typing)

The screens are rebuilt to look like /kyc, not recorded from it. When the
KYC page changes, update src/screens.jsx to match and render again.

Licence: Remotion is free for individuals and companies of up to 3 people;
larger companies need a Remotion company licence (remotion.dev/license).
