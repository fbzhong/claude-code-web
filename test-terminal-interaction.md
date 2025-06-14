# Terminal Testing Guide

## How to test the terminal functionality:

1. Open browser to http://localhost:3000
2. Login with:
   - Username: testuser
   - Password: testpass123

3. Once logged in, you should see:
   - A terminal interface with "Terminal initialized" message
   - A sidebar button (hamburger menu) in the top left
   - Claude status indicator showing "stopped"

4. Test terminal interaction:
   - Type commands like `ls`, `pwd`, `echo "hello"`
   - Commands should execute and show output
   - The terminal should be fully interactive

5. Test Claude Code controls:
   - Click the hamburger menu to open the sidebar
   - Try the "Start Claude", "Stop Claude", and "Restart Claude" buttons
   - Command history should appear in the sidebar

## Current Status:
- ✅ Backend running on port 3001
- ✅ Frontend running on port 3000
- ✅ WebSocket connections established
- ✅ xterm.js dimensions error fixed with MinimalTerminal
- ✅ PTY functionality verified via backend tests
- 🔄 Terminal interaction ready for testing

## Debug Information:
- Backend logs: tail -f /tmp/backend.log
- Frontend logs: tail -f /tmp/frontend.log
- Test user created: testuser/testpass123