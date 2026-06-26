import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ItemForm from './pages/ItemForm'
import ItemDetail from './pages/ItemDetail'
import Channels from './pages/Channels'
import PublicItem from './pages/PublicItem'
import { Spinner } from './components/ui'

function Protected() {
  const { session, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Login />
  return <Layout />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public, no auth required */}
          <Route path="/p/:token" element={<PublicItem />} />

          {/* Authenticated app */}
          <Route element={<Protected />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/channels" element={<Channels />} />
            <Route path="/item/new" element={<ItemForm />} />
            <Route path="/item/:id" element={<ItemDetail />} />
            <Route path="/item/:id/edit" element={<ItemForm />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
