# DK Gradschool Dashboard

Static interactive dashboard for US graduate programs in data science and analytics.

## Files

- `index.html`: dashboard shell
- `styles.css`: responsive visual styling
- `app.js`: filters, map interaction, detail panel, and list behavior
- `data/schools.json`: frontend data source
- `scripts/extract_schools.py`: regenerate JSON from the latest `schools.xlsx`

## Regenerate data

```bash
python3 "scripts/extract_schools.py" "/Users/bcc-admin/Downloads/schools.xlsx" "data/schools.json"
```

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.
