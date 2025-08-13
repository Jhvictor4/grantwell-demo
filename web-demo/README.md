# Grants Search Web Demo

A minimal, monochrome web application for searching federal grant opportunities using the Grants.gov API.

## Features

- 🔍 **Search Interface**: Clean search bar with real-time results
- 📋 **Table View**: Scrollable, sortable table with grant information
- 📄 **Detail Panel**: Sliding side panel with comprehensive grant details
- 🎨 **Minimal Design**: Monochrome UI with focus on functionality
- 📱 **Responsive**: Works on desktop and mobile devices

## Tech Stack

- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Vanilla Web Components** - No framework dependencies
- **CSS Grid/Flexbox** - Modern responsive layouts

## API Endpoints

- **Search**: `https://micro.grants.gov/rest/opportunities/search` (POST with JSON body)
- **Details**: `https://apply07.grants.gov/grantsws/rest/opportunity/details` (POST with form data)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── SearchBar.ts    # Search input and button
│   ├── ResultsTable.ts # Grant results table
│   └── DetailPanel.ts  # Sliding detail panel
├── services/           # API and business logic
│   └── grantsApi.ts   # Grants.gov API service
├── types/             # TypeScript type definitions
│   └── grants.ts      # Grant-related interfaces
├── styles/            # CSS styles
│   └── main.css       # Main stylesheet
└── main.ts           # App entry point and orchestration
```

## Usage

1. **Search**: Enter keywords in the search bar or leave empty to see all grants
2. **Browse**: Scroll through the results table to find grants of interest
3. **Details**: Click any row to open detailed information in the side panel
4. **Close**: Click the × button or press Escape to close the detail panel

## Features in Detail

### Search Functionality
- Searches through title, description, and other grant fields
- Empty search returns all available grants
- Real-time loading states and error handling

### Results Table
- Shows key grant information: title, agency, dates, status
- Status indicators with color coding
- Hover effects for better UX
- Responsive column sizing

### Detail Panel
- Comprehensive grant information
- Award amounts with currency formatting
- Important dates and contact information
- CFDA numbers and eligibility requirements
- Smooth slide-in/out animations

## Browser Support

- Chrome/Edge 88+
- Firefox 78+  
- Safari 14+

## Development

The application is built with modern web standards and requires no runtime dependencies. All components are written in TypeScript as ES6 classes for better maintainability and reusability.