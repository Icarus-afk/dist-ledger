import { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { RoleContext } from './context/RoleContext';
import { NetworkContext } from './context/NetworkContext';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';
import { fetchNetworkHealth } from './services/networkService';

function App() {
  const [currentRole, setCurrentRole] = useState('distributor');
  const [currentView, setCurrentView] = useState('dashboard');
  const [networkStatus, setNetworkStatus] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getNetworkStatus = async () => {
      setLoading(true);
      try {
        const data = await fetchNetworkHealth();
        if (data.success) {
          setNetworkStatus(data.network);
        }
      } catch (error) {
        console.error('Failed to fetch network status:', error);
      } finally {
        setLoading(false);
      }
    };

    getNetworkStatus();
    // Set up interval to periodically check network status
    const intervalId = setInterval(getNetworkStatus, 30000);
    
    return () => clearInterval(intervalId);
  }, [currentRole]);

  return (
    <BrowserRouter>
      <RoleContext.Provider value={{ currentRole, setCurrentRole }}>
        <NetworkContext.Provider value={{ networkStatus, loading }}>
          <div className="flex flex-col min-h-screen bg-gray-100">
            <Header />
            <div className="flex flex-1">
              <Sidebar 
                currentView={currentView} 
                setCurrentView={setCurrentView} 
              />
              <MainContent 
                currentView={currentView} 
                setCurrentView={setCurrentView} 
              />
            </div>
          </div>
        </NetworkContext.Provider>
      </RoleContext.Provider>
    </BrowserRouter>
  );
}

export default App;
