# data/

This folder holds your personal resume data and the SQLite database. Everything here except the example files and instructions is gitignored.

| File | Purpose |
|------|---------|
| `jobs.db` | SQLite database, created by `npm run db:init` |
| `master-resume-template.docx` | Your resume template. Upload it on the Resume page or copy it here. See `RESUME-TEMPLATE-INSTRUCTIONS.txt` for the supported `{tags}`. |
| `master-content.json` | Optional baseline text for the narrative tags. Copy `master-content.example.json` to `master-content.json` and fill it in. |
