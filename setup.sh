#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Creating Dist-Ledger Frontend Project Structure...${NC}"

# Create Vite React project
echo -e "${GREEN}Creating a new React project with Vite...${NC}"
npm create vite@latest dist-ledger-frontend -- --template react
cd dist-ledger-frontend

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install react-router-dom axios

# Install Tailwind CSS
echo -e "${GREEN}Setting up Tailwind CSS...${NC}"
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Update Tailwind config
echo -e "${GREEN}Configuring Tailwind CSS...${NC}"
cat > tailwind.config.js << 'EOL'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        }
      }
    },
  },
  plugins: [],
}
EOL

# Update CSS file
echo -e "${GREEN}Adding Tailwind directives to CSS...${NC}"
cat > src/index.css << 'EOL'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50;
}
EOL

# Create folder structure
echo -e "${GREEN}Creating folder structure...${NC}"
mkdir -p src/components/common
mkdir -p src/components/auth
mkdir -p src/components/manufacturer
mkdir -p src/components/distributor
mkdir -p src/components/retailer
mkdir -p src/components/system
mkdir -p src/pages/auth
mkdir -p src/pages/shared
mkdir -p src/pages/manufacturer
mkdir -p src/pages/distributor
mkdir -p src/pages/retailer
mkdir -p src/pages/system
mkdir -p src/api
mkdir -p src/context
mkdir -p src/utils

# Create Authentication Pages
echo -e "${GREEN}Creating Authentication Page Files...${NC}"
touch src/pages/auth/Login.jsx
touch src/pages/auth/Register.jsx

# Create Shared Pages
echo -e "${GREEN}Creating Shared Page Files...${NC}"
touch src/pages/shared/Home.jsx
touch src/pages/shared/Products.jsx
touch src/pages/shared/ProductDetails.jsx
touch src/pages/shared/Entities.jsx
touch src/pages/shared/NotFound.jsx

# Create Manufacturer Pages
echo -e "${GREEN}Creating Manufacturer Page Files...${NC}"
touch src/pages/manufacturer/Dashboard.jsx
touch src/pages/manufacturer/ProductRegistration.jsx

# Create Distributor Pages
echo -e "${GREEN}Creating Distributor Page Files...${NC}"
touch src/pages/distributor/Dashboard.jsx
touch src/pages/distributor/Inventory.jsx
touch src/pages/distributor/ReceiveFromManufacturer.jsx
touch src/pages/distributor/ShipToRetailer.jsx
touch src/pages/distributor/ProcessReturns.jsx

# Create Retailer Pages
echo -e "${GREEN}Creating Retailer Page Files...${NC}"
touch src/pages/retailer/Dashboard.jsx
touch src/pages/retailer/Inventory.jsx
touch src/pages/retailer/ReceiveShipment.jsx
touch src/pages/retailer/RecordSale.jsx
touch src/pages/retailer/ReturnProduct.jsx
touch src/pages/retailer/Sales.jsx

# Create System Pages
echo -e "${GREEN}Creating System Page Files...${NC}"
touch src/pages/system/Health.jsx
touch src/pages/system/Init.jsx

# Create Common Components
echo -e "${GREEN}Creating Common Component Files...${NC}"
touch src/components/common/Header.jsx
touch src/components/common/Footer.jsx
touch src/components/common/Navbar.jsx
touch src/components/common/Sidebar.jsx
touch src/components/common/Layout.jsx
touch src/components/common/Card.jsx
touch src/components/common/Button.jsx
touch src/components/common/Table.jsx
touch src/components/common/Alert.jsx
touch src/components/common/Modal.jsx
touch src/components/common/Loading.jsx

# Create Context Files
echo -e "${GREEN}Creating Context Files...${NC}"
touch src/context/AuthContext.jsx

# Create API Files
echo -e "${GREEN}Creating API Files...${NC}"
touch src/api/index.js
touch src/api/auth.js
touch src/api/products.js
touch src/api/entities.js
touch src/api/manufacturer.js
touch src/api/distributor.js
touch src/api/retailer.js
touch src/api/system.js

# Create App Routes File
echo -e "${GREEN}Creating Routes File...${NC}"
touch src/routes.jsx

echo -e "${BLUE}Setup Complete! Project structure has been created.${NC}"
echo -e "${BLUE}To start the development server, run: npm run dev${NC}"