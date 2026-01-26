#!/bin/bash

# Git Cleanup Script
# This script will clean up the detached branches and simplify your git setup

echo "🧹 Cleaning up git branches..."

# Make sure we're on main branch
git checkout main

# Delete remote branches (detached and detached2)
echo "🗑️  Deleting remote branches..."
git push origin --delete detached 2>/dev/null || echo "Branch 'detached' may not exist on remote"
git push origin --delete detached2 2>/dev/null || echo "Branch 'detached2' may not exist on remote"

# Prune remote references
echo "🧹 Pruning remote references..."
git fetch origin --prune

# Verify cleanup
echo ""
echo "✅ Cleanup complete! Current branches:"
git branch -a

echo ""
echo "📋 Current status:"
git status
