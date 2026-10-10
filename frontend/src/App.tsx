import { BrowserRouter, Route, Routes } from 'react-router';
import { RecipeListPage } from './pages/RecipeListPage.js';
import { RecipeEditorPage } from './pages/RecipeEditorPage.js';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RecipeListPage />} />
        <Route path="/recipes/new" element={<RecipeEditorPage />} />
        <Route path="/recipes/:id" element={<RecipeEditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
