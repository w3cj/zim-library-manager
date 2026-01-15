import type { FC, PropsWithChildren } from "hono/jsx";
import { css, Style } from "hono/css";

type LayoutProps = PropsWithChildren<{
  title?: string;
  activeNav?: "browse" | "downloads" | "library" | "settings";
}>;

export const Layout: FC<LayoutProps> = ({
  children,
  title = "ZIM Library Manager",
  activeNav,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href="/styles/bootstrap.min.css" />
        <script src="/scripts/htmx.min.js"></script>
        <script defer src="/scripts/alpine-persist.min.js"></script>
        <script defer src="/scripts/alpine.min.js"></script>
        <Style>{css`
          .htmx-indicator {
            opacity: 0;
            transition: opacity 200ms ease-in;
          }
          .htmx-request .htmx-indicator,
          .htmx-request.htmx-indicator {
            opacity: 1;
          }
        `}</Style>
      </head>
      <body>
        <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
          <div class="container">
            <a class="navbar-brand" href="/">
              ZIM Library
            </a>
            <button
              class="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarNav"
            >
              <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
              <ul class="navbar-nav">
                <li class="nav-item">
                  <a
                    class={`nav-link ${activeNav === "browse" ? "active" : ""}`}
                    href="/browse"
                  >
                    Browse
                  </a>
                </li>
                <li class="nav-item">
                  <a
                    class={`nav-link ${activeNav === "downloads" ? "active" : ""}`}
                    href="/downloads"
                  >
                    Downloads
                  </a>
                </li>
                <li class="nav-item">
                  <a
                    class={`nav-link ${activeNav === "library" ? "active" : ""}`}
                    href="/library"
                  >
                    Library
                  </a>
                </li>
                <li class="nav-item">
                  <a
                    class={`nav-link ${activeNav === "settings" ? "active" : ""}`}
                    href="/settings"
                  >
                    Settings
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </nav>
        <main class="container mt-4">{children}</main>
        <script src="/scripts/bootstrap.bundle.min.js"></script>
      </body>
    </html>
  );
};
