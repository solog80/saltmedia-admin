# Quick Start Guide - Saltmedia Ad System

## 🚀 3-Step Setup

### Step 1: Fix Permissions (1 minute)
Copy this and run in your terminal:
```bash
sudo chown -R $USER /Users/solomacbookair/Documents/myApps/saltmedia-admin-app/src/components/ui
```

### Step 2: Install Components & Dependencies (2 minutes)
Run this script:
```bash
bash /Users/solomacbookair/Documents/myApps/saltmedia-admin-app/setup-ui-components.sh
```

The script will:
- Copy 6 UI components (badge, checkbox, dropdown-menu, tabs, alert, textarea)
- Install recharts for analytics charts
- Show success confirmation

### Step 3: Start the App (1 minute)
```bash
cd /Users/solomacbookair/Documents/myApps/saltmedia-admin-app
npm run dev
```

Then open: **http://localhost:3000/ads**

---

## 🎯 What You'll See

After startup, you'll have access to:

### Ads Management Tab
- **View All Ads** - Table of all advertisements
- **Create Ad** - Button to add new ads
- **Filters** - Search by name, filter by status/type/placement
- **Actions** - Edit, activate/deactivate, or delete ads per row

### Analytics Tab
- **Key Metrics** - Total impressions, clicks, CTR, completion rate
- **Impression Trends** - Line chart of impressions over time
- **Engagement Funnel** - Bar chart showing video ad completion stages
- **Top Ads** - Table ranking ads by performance

---

## 📝 Creating Your First Ad

1. Click **"Create Ad"** button
2. Fill in **Basic Tab**:
   - Ad Name (e.g., "Summer Sale 2024")
   - Ad Type (Manual or VAST)
   - Status (Active/Inactive/Pending)
   - Select Placements (Pre-roll, Mid-roll, Banner)
   - Set Priority (1-100)
   - Select Date Range

3. Fill in **Creative Tab**:
   - For Manual Ads: Upload/paste creative URL
   - For VAST Ads: Paste VAST tag URL
   - Add landing page URL

4. Fill in **Targeting Tab**:
   - Select content types (Live TV, On-Demand, All)
   - Set frequency cap (e.g., 5 per 24 hours)

5. Click **"Create Advertisement"**

---

## 🔍 Features Checklist

### ✅ Ad Management
- [x] Create ads (manual & VAST)
- [x] Edit existing ads
- [x] Delete ads with confirmation
- [x] Change ad status (activate/deactivate)
- [x] View all ads in sortable table
- [x] Pagination support

### ✅ Filtering & Search
- [x] Search by ad name
- [x] Filter by status
- [x] Filter by type (manual/VAST)
- [x] Filter by placement
- [x] Date range picker

### ✅ Analytics
- [x] View impressions and clicks
- [x] Track CTR (click-through rate)
- [x] Monitor completion rates
- [x] Trend analysis
- [x] Top performing ads ranking

---

## 📂 Key Files

| File | Location | Purpose |
|------|----------|---------|
| Ads Page | `src/app/ads/page.tsx` | Main dashboard |
| Ad Form | `src/app/components/ads/AdForm.tsx` | Create/edit form |
| Analytics | `src/app/components/ads/AdAnalyticsDashboard.tsx` | Charts & metrics |
| API | `src/lib/api/ads.ts` | Firestore integration |

---

## 🔗 Navigation

Add to sidebar links:
```
Dashboard → /home
Ads → /ads  ← NEW
Analytics → /analytics
```

The sidebar has already been updated with the Advertisements link!

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission denied | Run: `sudo chown -R $USER /path/to/ui` |
| Missing components | Run: `bash setup-ui-components.sh` |
| recharts not found | Run: `npm install recharts` |
| Port 3000 in use | Run: `npm run dev -- -p 3001` |

---

## 📞 Support Files

- **Full Details**: Read `IMPLEMENTATION_SUMMARY.md`
- **Architecture**: Read `AD_SYSTEM_ARCHITECTURE.md`
- **Setup Help**: Read `MISSING_UI_COMPONENTS.md`

---

## ✨ You're All Set!

Once setup is complete, your admin dashboard will have full ad management capabilities with real-time analytics.

**Next Steps** (optional):
- Create test ads
- View analytics data
- Set up CloudFunctions for mobile app
- Implement Flutter mobile integration

Enjoy! 🎉