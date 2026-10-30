# Triangle Reads

A static website listing book and reading events at libraries and bookstores in the Triangle (Wake, Durham, Orange and Chatham counties). Plain HTML, CSS and JavaScript, with no build step, so it runs on GitHub Pages as is.

## What's here

| Path | What it is |
| --- | --- |
| `index.html` | The page |
| `css/style.css` | Styles (light and dark mode) |
| `js/app.js` | Search, filters, list view and month calendar |
| `data/events.js` | The events the page shows (generated, don't edit by hand) |
| `data/events.json` | Same events as JSON, for other uses |
| `data/events_2026-11.csv` | Source event list for November 2026 |
| `data/triangle_*.csv` | Libraries, bookstores, towns and counties used to tag events |
| `tools/build_events.py` | Turns event CSVs into `data/events.js` |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

## Preview on your computer

Double-click `index.html`. It works straight from the folder, no server needed.

## Put it on GitHub Pages

1. Create a new repository on GitHub (for example `triangle-reads`).
2. Upload everything in this folder to the repository (on the repository page: **Add file → Upload files**, then drag in the folder contents, including the `css`, `js`, `data` and `tools` folders).
3. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/triangle-reads/`.

## Adding next month's events

1. Make a CSV with the same columns as `data/events_2026-11.csv`:
   `date,start,end,title,host,location,url,notes`
   (dates as `YYYY-MM-DD`, times as 24-hour `HH:MM`, blank for all-day).
2. Save it in `data/`, for example `data/events_2026-12.csv`.
3. From this folder, run all the months you want on the site:

   ```
   python tools/build_events.py data/events_2026-11.csv data/events_2026-12.csv
   ```

4. Upload the new `data/events.js` (and the CSV) to GitHub.

### How events are tagged

- **Type** is guessed from the title: "book club" → Book Club, "storytime" or "kids" → For Kids, "poetry" or "slam" → Poetry, "workshop" or "writer's" → Writing, "Author Name: Book Title" → Author Event, and so on. An event can have more than one type.
- **Location** is the city or town at the end of the address, matched against `triangle_municipalities.csv`.
- **Space** is Library when the venue is a library, Bookstore when the event is at the store's own address, and Other Venue for breweries, museums and similar.

To override any guess, add a `type`, `city` or `space` column to your CSV. Separate multiple types with semicolons, for example `Author Event; For Kids`. The type names are listed at the top of `tools/build_events.py`.

Every page view leaves the filter choices in the address bar, so you can share a link like `…/#type=For%20Kids&city=Durham`.
