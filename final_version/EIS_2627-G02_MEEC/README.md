# CourierCMS – Courier Management System (EIS_2627-G02_MEEC)

Group project for **Enterprise Information Systems** (MEEC, FEUP, 2026/2027).
Sprint 1 is a static prototype: HTML, CSS and JavaScript only, with sample data
and a Leaflet map. Sprint 2 adds the database and PHP.

## Team

| Name | Student ID | Student email |
| --- | --- | --- |
| Gonçalo Trindade | 202210332 | up202210332@up.pt |
| João Dias | 202207996 | up202207996@up.pt |
| Rafael Lemos (team leader) | 202208622 | up202208622@up.pt |
| Guilherme Tavares | 202210168 | up202210168@up.pt |
| Miguel Moreira | 202207802 | up202207802@up.pt |

## How to run

**NetBeans:** File → Open Project → choose the `EIS_2627-G02_MEEC` folder
(it is already an HTML5/JavaScript project) → Run Project (F6).
It opens `public_html/index.html` in the browser.

**Without NetBeans:** open `public_html/index.html` in a browser.

Everything works offline (Leaflet is a local copy in `public_html/vendor/leaflet/`),
except the map tiles, which come from OpenStreetMap and need Internet.

Demo accounts (also shown on the login page):

| Role | Email | Password |
| --- | --- | --- |
| Client | client@demo.com | Client123 |
| Courier | courier@demo.com | Courier123 |
| Staff | staff@couriercms.com | Staff1234 |
| Admin | admin@couriercms.com | Admin1234 |

## Structure

```
nbproject/            NetBeans project (site root = public_html, start file = index.html)
public_html/
  index.html login.html register.html team.html      public pages
  client.html courier.html staff.html admin.html     one page per role
  css/      style.css (shared), forms.css (login, register, team), <page>.css
  js/       validation.js, nav.js, users.js (shared), <page>.js, <page>-data.js
  vendor/   leaflet/ (map library 1.9.4 + marker images, local copy)
docs/       ER_Model.png (high resolution) + .pdf, Use_Case_Diagram.pdf,
            Requirements.xlsx, Pages rough sketch.pdf
```

## Conventions

- UI text in English; code comments may be in Portuguese.
- One shared `css/style.css`; each page only adds its own `css/<page>.css`.
- Forms use `js/validation.js` and one `<p id="<field>-error">` per field.
- `js/nav.js` only on pages with `#nav-toggle`, `#main-nav` and `#year`.
- Test accounts live only in `js/users.js`.
- Validate every page at https://validator.w3.org/ before committing.
- Work on your own files, `git pull` before every `git push`.
