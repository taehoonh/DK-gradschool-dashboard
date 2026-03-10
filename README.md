# US Graduate Programs Dashboard

Static interactive dashboard for the `schools.xlsx` dataset.

## Files

- `index.html`: dashboard shell
- `styles.css`: responsive visual styling
- `app.js`: filters, list, detail panel, and Leaflet map logic
- `data/schools.json`: normalized program data for the frontend
- `scripts/extract_schools.py`: regenerate JSON from the original Excel file

## Regenerate data

```bash
python3 output/dashboard/scripts/extract_schools.py /Users/bcc-admin/Downloads/schools.xlsx output/dashboard/data/schools.json
```

## Run locally

```bash
python3 -m http.server 8000 --directory output/dashboard
```

Open `http://localhost:8000`.
