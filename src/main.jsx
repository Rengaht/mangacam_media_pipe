import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Test from './test.jsx'
import AppV2 from './v2/AppV2.jsx'
import AppV2B from './v2/AppV2B.jsx'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

createRoot(document.getElementById('root')).render(
  // <StrictMode>
  <BrowserRouter>
    {/* <App /> */}
    <Routes>
      <Route path="/v1" element={<App />} />
      <Route path="/test" element={<Test />} />
      <Route path="/" element={<AppV2 />} />
      <Route path="/B" element={<AppV2B />} />
    </Routes>
  </BrowserRouter>
  
)
