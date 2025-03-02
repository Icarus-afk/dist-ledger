import { useContext } from 'react';
import { RoleContext } from '../../context/RoleContext';
import { FaLink } from 'react-icons/fa';

const Header = () => {
  const { currentRole, setCurrentRole } = useContext(RoleContext);

  const handleRoleChange = (e) => {
    setCurrentRole(e.target.value);
  };

  return (
    <header className="bg-sidebar text-white py-3 px-4">
      <div className="container mx-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <FaLink /> SupplyChain Ledger Network
          </h3>
          <div className="flex items-center gap-2">
            <span>Role:</span>
            <select 
              className="bg-sidebarHover text-white border border-gray-600 rounded px-2 py-1 text-sm"
              value={currentRole}
              onChange={handleRoleChange}
            >
              <option value="distributor">Distributor Staff</option>
              <option value="retailer">Retailer Staff</option>
              <option value="admin">System Administrator</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
