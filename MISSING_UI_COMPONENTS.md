# Missing UI Components

The ads system requires the following UI components that are not yet in the project. You can either:
1. Use shadcn/ui to install them: `npx shadcn-ui@latest add <component>`
2. Copy them from the stream-platform-web project
3. Use alternative UI libraries

## Required Components

### Core Components
- **badge** - For status and type badges
  ```bash
  npx shadcn-ui@latest add badge
  ```

- **checkbox** - For placement and targeting selection
  ```bash
  npx shadcn-ui@latest add checkbox
  ```

- **dropdown-menu** - For bulk actions and item menus
  ```bash
  npx shadcn-ui@latest add dropdown-menu
  ```

- **tabs** - For form and dashboard tabs
  ```bash
  npx shadcn-ui@latest add tabs
  ```

- **alert** - For error and success messages
  ```bash
  npx shadcn-ui@latest add alert
  ```

- **textarea** - For VAST tag URLs and descriptions
  ```bash
  npx shadcn-ui@latest add textarea
  ```

### Chart Library
- **recharts** - For analytics visualizations
  ```bash
  npm install recharts
  ```

## Files Using These Components

- `src/app/ads/page.tsx` - Uses: Badge, Button, Card, Table, Alert, Checkbox, Dropdown, Select
- `src/app/components/ads/AdForm.tsx` - Uses: Tabs, Checkbox, Textarea, Select, Alert
- `src/app/components/ads/AdAnalyticsDashboard.tsx` - Uses: Card, Table, Tabs, Badge, LineChart, BarChart

## Quick Install All

```bash
npx shadcn-ui@latest add badge checkbox dropdown-menu tabs alert textarea
npm install recharts
```

After installing, the ads system will be fully functional.