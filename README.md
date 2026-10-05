# Trackr — Project Tracker

Trackr is a lightweight project dashboard for organizing personal and development work. The application reads its project list from `projects.json`, so the data is part of the project files and can be published with the site on GitHub Pages.

## Features

- Dashboard with project totals, status counts, overall completion, deadlines, and recent updates
- Create, edit, and delete projects in the dashboard; each save downloads an updated `projects.json`
- Project cards with status, priority, progress, deadline, and tags
- Search, status and priority filters, and sorting
- Project detail pages with tasks and project dates
- Download the currently loaded project data as `projects.json`
- Responsive dark interface for desktop, tablet, and mobile
- No account, backend, APIs, or runtime dependencies

## Technologies

- Semantic HTML5
- CSS3
- Vanilla JavaScript
- Static JSON file loaded with the browser Fetch API

## Run locally

No installation or build step is needed. Because browsers restrict `fetch()` for files opened directly with a `file://` URL, run this folder using a local static web server, or deploy it to GitHub Pages. The app does not store project data in `localStorage`.

## Add or update projects

You can create or edit projects using the dashboard. Each save downloads an updated file named `projects.json`. Replace the existing file in your project folder with the download. It must contain a JSON array. A project object looks like this:

```json
[
  {
    "id": "website-redesign",
    "name": "Website Redesign",
    "url": "https://github.com/you/website-redesign",
    "description": "Redesign the company website",
    "fullDescription": "A detailed explanation of the project, its goals, features, setup instructions, and other important information.",
    "status": "in-progress",
    "priority": "high",
    "progress": 65,
    "deadline": "2026-11-15",
    "tags": ["Web", "Design"],
    "tasks": [
      {
        "id": "create-homepage",
        "title": "Create homepage",
        "completed": false
      }
    ],
    "createdAt": "2026-10-01T09:00:00.000Z",
    "updatedAt": "2026-10-05T09:00:00.000Z"
  }
]
```

The optional `url` field points to the project repository, live site, or project page. It must be an `http://` or `https://` URL and appears as an **Open project** link in the project card and details. The optional `fullDescription` field holds up to 10,000 characters of long-form project information, shown on the project details page; the shorter `description` is used on project cards. Allowed statuses are `planned`, `in-progress`, `completed`, and `on-hold`. Allowed priorities are `low`, `medium`, and `high`. Progress is a whole number from 0 to 100. After replacing the local file, refresh the dashboard to see the changes. To publish them, commit and push `projects.json` to the GitHub Pages branch. A static GitHub Pages site cannot write directly to the repository, so downloading the new JSON does not publish it automatically.

## Deploy with GitHub Pages

1. Add `index.html`, `style.css`, `app.js`, `projects.json`, and this README to the root of a GitHub repository.
2. Open the repository’s **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the branch you want to publish and the `/ (root)` folder, then save.
5. When deployment completes, open the Pages URL shown in the repository settings.

The project uses relative asset paths and does not require a build pipeline, so it works from a GitHub Pages project URL as well as a user or organization site.

## Data storage and privacy

The dashboard fetches `projects.json` each time it loads and does not use `localStorage`. Changes made in the app are held in memory and downloaded as a replacement JSON file. Replace the file in your repository and publish the change to make it visible on GitHub Pages. Project data is not sent to a separate service.

## Future improvements

- Optional project templates and customizable status labels
- In-browser editing with an authenticated storage service
- Theme and display preferences
- Optional encrypted backup workflows
- Accessible keyboard shortcuts and additional usability refinements
