import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TeamPage from './pages/TeamPage';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/team/edit/:token" element={<TeamPage mode="edit" />} />
            <Route path="/team/view/:token" element={<TeamPage mode="view" />} />
        </Routes>
    );
}
