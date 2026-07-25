#!/bin/bash

# UI Components Setup Script for saltmedia-admin-app
# This script copies required UI components and installs dependencies

set -e

echo "🚀 Setting up UI Components for Ad System..."

# Define source and destination
SOURCE_DIR="/Users/solomacbookair/Documents/myApps/stream-platform-web/playitloudadmin/components/ui"
DEST_DIR="/Users/solomacbookair/Documents/myApps/saltmedia-admin-app/src/components/ui"
PROJECT_DIR="/Users/solomacbookair/Documents/myApps/saltmedia-admin-app"

# Step 1: Fix permissions if needed
echo "📁 Checking directory permissions..."
if [ ! -w "$DEST_DIR" ]; then
    echo "⚠️  Permission denied on $DEST_DIR"
    echo "📝 To fix this, run:"
    echo "   sudo chown -R $(whoami) $DEST_DIR"
    exit 1
fi

# Step 2: Copy components
echo "📋 Copying UI components..."
COMPONENTS=("badge.tsx" "checkbox.tsx" "dropdown-menu.tsx" "tabs.tsx" "alert.tsx" "textarea.tsx")

for component in "${COMPONENTS[@]}"; do
    if [ -f "$SOURCE_DIR/$component" ]; then
        cp "$SOURCE_DIR/$component" "$DEST_DIR/$component"
        echo "  ✅ Copied $component"
    else
        echo "  ❌ Warning: $component not found in source"
    fi
done

# Step 3: Install recharts
echo "📦 Installing recharts..."
cd "$PROJECT_DIR"
npm install recharts

echo ""
echo "✨ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "UI Components installed:"
echo "  • badge"
echo "  • checkbox"
echo "  • dropdown-menu"
echo "  • tabs"
echo "  • alert"
echo "  • textarea"
echo ""
echo "Dependencies installed:"
echo "  • recharts"
echo ""
echo "Your Ad System is now ready to use! 🎉"
echo ""
echo "Next steps:"
echo "1. Run: npm run dev"
echo "2. Navigate to: http://localhost:3000/ads"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"