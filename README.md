# showcase-multi-tenant-saas-admin-portal
Run tenant revenue, hierarchy, support, and subscriptions from one admin portal. Built with Charts, HeatMap, TreeGrid, Kanban, Scheduler, DataGrid, Gantt Chart, and AI AssistView.

## Prerequisites

- [Node.js](https://nodejs.org/) 20.19 or later, or 22.12 or later
- npm (included with Node.js)
- A Syncfusion license key is optional. The app runs without one. A key removes the trial banner. Get a [community license](https://www.syncfusion.com/products/community-license) or a trial key from Syncfusion.

## Run the app

From the repository root:

```bash
cd react
npm install
```

Copy the environment file and, if you have a key, paste it into `VITE_SYNCFUSION_LICENSE_KEY`.

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
copy .env.example .env
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Production build

From the `react` folder:

```bash
npm run build
npm run preview
```

`npm run build` type-checks the project and writes the site to `react/dist`. `npm run preview` serves that folder at [http://localhost:4173](http://localhost:4173).

## License

Syncfusion components require a valid [Syncfusion license](https://www.syncfusion.com/products/community-license) for production use. This sample is a reference implementation.