import { StrictMode } from "react"
import { createRoot, hydrateRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import "./index.css"
import "./site.css"
import "./admin-design.css"
import "./enquiry-design.css"
import "./approach-design.css"
import "./services-intro.css"
import "./service-catalog.css"
import App from "./App.tsx"
import type { Content } from "../../server/shared/content"

const initialNode = document.getElementById("initial-content")
const initial = initialNode
  ? (JSON.parse(initialNode.textContent || "{}") as Content)
  : undefined
const application = (
  <StrictMode>
    <BrowserRouter>
      <App initial={initial} />
    </BrowserRouter>
  </StrictMode>
)
if (initial) hydrateRoot(document.getElementById("root")!, application)
else createRoot(document.getElementById("root")!).render(application)
import "./rental-design.css"
import "./rental-polish.css"

import "./rental-theme.css"
import "./rental-premium.css"
import "./rental-header.css"
import "./rental-layout.css"
import "./rental-videos.css"
import "./rental-bloom.css"
