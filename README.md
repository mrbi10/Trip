# Trip Dashboard

A simple and clean web dashboard to track trip cost, per-head split, location, dates, and more.  
Built using React and deployed on GitHub Pages.

---

## Features
- Add trip details (date, location, total cost, days, and members)
- Auto-calculate per-head cost
- Lightweight UI without Tailwind
- Instant updates as you type
- Works on any device

---

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/mrbi10/Trip
cd Trip

2. Install dependencies

npm install

3. Run the project locally

npm start

The app will open at http://localhost:3000.


---

Deployment (GitHub Pages)

This project uses gh-pages to deploy the build.

1. Install gh-pages

npm install gh-pages --save-dev

2. Add lines to package.json

"homepage": "https://mrbi10.github.io/Trip",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d build"
}

3. Deploy

npm run deploy

Your site will be live at:

https://mrbi10.github.io/Trip


---

Folder Structure

src/
  components/
  pages/
  App.js
  index.js
  index.css
public/
README.md


---

Troubleshooting

App not starting?

Try:

npm install
npm start

Build failed?

Remove node_modules and reinstall:

rm -rf node_modules package-lock.json
npm install


---

License

Free to use. No restrictions.


---

Author

Built by Mrbi
GitHub: https://github.com/mrbi10

