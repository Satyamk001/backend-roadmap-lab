import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { CommandPalette } from './components/layout/CommandPalette';
import { HomePage } from './pages/HomePage';
import { StagePage } from './pages/StagePage';
import { DayPage } from './pages/DayPage';
import { SingleDemoPage } from './pages/SingleDemoPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // The palette and the mobile drawer are both modal. Never leave both open:
  // the drawer's focus trap would otherwise capture the palette's input.
  const openCommandPalette = () => {
    setIsCommandPaletteOpen(true);
    setIsMobileSidebarOpen(false);
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen((isOpen) => !isOpen);
    setIsCommandPaletteOpen(false);
  };

  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <div className="app-canvas min-h-screen text-theme-text flex flex-col font-sans transition-colors duration-150">
        {/* Accessible Skip to Content Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-theme-primary focus:text-theme-primary-text focus:font-bold focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-theme-primary"
        >
          Skip to main content
        </a>

        <Navbar
          onOpenCommandPalette={openCommandPalette}
          onToggleMobileMenu={toggleMobileSidebar}
          isMobileMenuOpen={isMobileSidebarOpen}
        />

        <div className="flex-1 flex w-full">
          {/* Desktop & Mobile Slide-Over Sidebar */}
          <Sidebar
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={closeMobileSidebar}
          />

          {/* Main Content Area */}
          <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 outline-none">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/stage/:stageId" element={<StagePage />} />
              <Route path="/stage/:stageId/day/:dayId" element={<DayPage />} />
              <Route path="/stage/:stageId/day/:dayId/:demoId" element={<SingleDemoPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>

        {/* Global Quick Command Palette (Cmd+K) */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onOpen={openCommandPalette}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
