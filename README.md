# Local Eats

A website for finding the best restaurants in our area. It runs entirely in the browser, with no build step, server or dependencies.

## Features

- **Search** by name, cuisine, dish, neighborhood or feature (for example "outdoor seating")
- **Filters**: cuisine, neighborhood, price ($–$$$$), minimum rating, open now, favorites
- **Sorting**: best match (a rating weighted by review count), highest rated, most reviewed, price, name
- **Details view** with hours (today highlighted), phone, directions link and tags
- **Favorites** saved in your browser
- **Shareable links**: the current search and filters are kept in the URL
- Responsive layout with light and dark mode

## Running it

Open `index.html` in a browser. To serve it locally instead:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

It can be deployed as-is to any static host (GitHub Pages, Netlify, Vercel and so on).

## Adding your restaurants

The restaurants included are **sample data**. To use real places:

1. Open `js/data.js`.
2. Set `SITE_CONFIG.areaName` to your town or neighborhood.
3. Replace the entries in `RESTAURANTS`. The comment at the top of the file describes each field.

Cuisine and neighborhood filter options are generated from the data automatically.

## Project layout

```
index.html       page markup
css/styles.css   styles
js/data.js       site config and restaurant data
js/app.js        search, filters, sorting, details, favorites
```
