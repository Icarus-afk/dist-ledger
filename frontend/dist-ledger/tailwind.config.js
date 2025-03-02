/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        distributor: "#3498db",
        retailer: "#2ecc71",
        main: "#9b59b6",
        sidebar: "#343a40",
        sidebarHover: "#495057",
        cardBorder: "#f0f0f0",
      },
      spacing: {
        'sidebar-width': '240px',
      }
    },
  },
  plugins: [],
};
