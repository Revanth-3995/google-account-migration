import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { DriveStudio } from './pages/DriveStudio';
import { PhotosStudio } from './pages/PhotosStudio';
import { Jobs } from './pages/Jobs';
import { History } from './pages/History';
import { Settings } from './pages/Settings';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <AppProvider>
      <div className="app-container">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="main-content">
          {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
          {activeTab === 'accounts' && <Accounts />}
          {activeTab === 'drive' && <DriveStudio setActiveTab={setActiveTab} />}
          {activeTab === 'photos' && <PhotosStudio setActiveTab={setActiveTab} />}
          {activeTab === 'jobs' && <Jobs />}
          {activeTab === 'history' && <History />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
