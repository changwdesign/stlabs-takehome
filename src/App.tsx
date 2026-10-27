import { Navigate, Route, Routes } from 'react-router-dom'
import { InboxPage } from '@/pages/InboxPage'
import { KitPage } from '@/pages/KitPage'
import { BulkEntry } from '@/pages/BulkEntry'
import { RunPage } from '@/pages/RunPage'
import { WorkflowsPage } from '@/pages/WorkflowsPage'
import { DemoControl } from '@/components/layout/DemoControl'
import { SessionProvider, useDemoReset } from '@/state/SessionProvider'

export default function App() {
  return (
    // Above the router on purpose: session state has to outlive the route so
    // a future /t/:id?as=requester reads the same sessions the inbox wrote.
    <SessionProvider>
      <AppRoutes />
      <DemoControl />
    </SessionProvider>
  )
}

function AppRoutes() {
  // Keyed on the demo epoch: a demo entry remounts every page, so local UI
  // state (open panels, expanded sections) resets along with the sessions.
  const { epoch } = useDemoReset()
  return (
    <Routes key={epoch}>
      <Route path="/" element={<InboxPage />} />
      <Route path="/t/:ticketId" element={<InboxPage />} />
      {/* Demo shortcut: tkt-1 resolved, cohort panel open */}
      <Route path="/bulk" element={<BulkEntry />} />
      <Route path="/workflows" element={<WorkflowsPage />} />
      <Route path="/workflows/runs/:runId" element={<RunPage />} />
      <Route path="/kit" element={<KitPage />} />
      {/* Sidebar destinations are placeholders in this prototype */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
