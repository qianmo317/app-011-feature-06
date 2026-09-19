import { Routes, Route, Link } from 'react-router-dom'
import PlanList from './pages/PlanList'
import PlanEditor from './pages/PlanEditor'
import WallEditor from './pages/WallEditor'
import BOM from './pages/BOM'
import PrintView from './pages/PrintView'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <Link to="/">家装材料用量与点位规划器</Link>
        </h1>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<PlanList />} />
          <Route path="/plan/:id" element={<PlanEditor />} />
          <Route path="/plan/:id/walls" element={<WallEditor />} />
          <Route path="/plan/:id/bom" element={<BOM />} />
          <Route path="/plan/:id/print" element={<PrintView />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
