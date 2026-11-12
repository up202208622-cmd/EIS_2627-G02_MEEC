# CourierCMS – Courier Management System (EIS_2627-G02_MEEC)

Group project for **Enterprise Information Systems** (MEEC, FEUP, 2026/2027).
Sprint 1 is a static prototype: HTML, CSS and JavaScript only, with sample data
and a Leaflet map. Sprint 2 adds the database and PHP.

## Team

| Name | Student email |
| --- | --- |
| Gonçalo Trindade | up202210332@up.pt |
| João Dias | up202207996@up.pt |
| Rafael Lemos (team leader) | up202208622@up.pt |
| Guilherme Tavares | up202210168@up.pt |
| Miguel Moreira | up202207802@up.pt |

## How to open

Open `index.html` in a browser.
All pages work offline except the map tiles, which come from OpenStreetMap.

Demo accounts (also shown on the login page):

| Role | Email | Password |
| --- | --- | --- |
| Client | client@demo.com | Client123 |
| Courier | courier@demo.com | Courier123 |
| Staff | staff@couriercms.com | Staff1234 |
| Admin | admin@couriercms.com | Admin1234 |

## Structure

```
index.html  login.html  register.html  team.html      public pages
client.html  courier.html  staff.html  admin.html     one page per role
css/     style.css (shared), forms.css (login, register, team), <page>.css
js/      validation.js, nav.js, users.js (shared), <page>.js
vendor/  leaflet/ (map library, local copy)
docs/    ER diagram, use cases, requirements
```

## Conventions

- UI text in English; code comments may be in Portuguese.
- One shared `css/style.css`; each page only adds its own `css/<page>.css`.
- Forms use `js/validation.js` and one `<p id="<field>-error">` per field.
- `js/nav.js` only on pages with `#nav-toggle`, `#main-nav` and `#year`.
- Test accounts live only in `js/users.js`.
- Validate every page at https://validator.w3.org/ before committing.
- Work on your own files, `git pull` before every `git push`.
