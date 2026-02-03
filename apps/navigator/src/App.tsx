import { Routes, Route } from 'react-router-dom';
import { NavigatorProvider } from './context/NavigatorContext';
import HomePage from './pages/HomePage';
import MuseumPage from './pages/MuseumPage';
import VisitPlayerPage from './pages/VisitPlayerPage';

function App() {
  return (
    <NavigatorProvider>
      <div className="h-full bg-surface-50">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/museum/:museumId" element={<MuseumPage />} />
          <Route path="/visit/:visitId" element={<VisitPlayerPage />} />
        </Routes>
      </div>
    </NavigatorProvider>
  );
}

export default App;
