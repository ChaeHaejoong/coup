import { Navigate, Route, Routes } from "react-router-dom";
import GamePage from "@/pages/GamePage";
import LobbyPage from "@/pages/LobbyPage";
import RoomPage from "@/pages/RoomPage";



export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/lobby" replace />} />
      <Route path="/lobby" element={<LobbyPage />} />
      <Route path="/room" element={<RoomPage />} />
      <Route path="/game" element={<GamePage />} />
    </Routes>
  );
}
