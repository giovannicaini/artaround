import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import HomePage from './pages/HomePage';
import MuseumPage from './pages/MuseumPage';
import VisitPlayerPage from './pages/VisitPlayerPage';

function App() {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="h-full bg-surface-950">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/museum/:museumId" element={<MuseumPage />} />
        <Route path="/visit/:visitId" element={<VisitPlayerPage />} />
      </Routes>
    </div>
  );
}

export default App;
