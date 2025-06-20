# Privacy Policy for Claude Code Web

## Overview

Claude Code Web is designed with privacy as a core principle. We believe in minimal data collection and maximum user privacy.

## What We Store

### In Database (Persistent)
- **User Authentication**:
  - Username (required for login)
  - Email address (required for authentication)
  - Password hash (bcrypt encrypted)
  - Account creation timestamp

- **Session Metadata**:
  - Session ID
  - Session name
  - Session status (active/detached/dead)
  - Creation and last activity timestamps

### In Memory Only (Not Persisted)
- Terminal output
- Command history
- Working directories
- Environment variables
- Terminal dimensions
- Cursor positions

## What We DON'T Store

We explicitly do NOT store:
- ❌ Command history in database
- ❌ Terminal output logs
- ❌ File access patterns
- ❌ Working directory history
- ❌ Environment variables
- ❌ User activity tracking
- ❌ Last login timestamps
- ❌ IP addresses
- ❌ Browser information
- ❌ Session recordings

## Data Lifecycle

### Active Sessions
- Terminal output and command history are kept in memory
- Data is available only while the session is active
- Memory is cleared when session ends

### Detached Sessions
- Only session metadata is preserved
- No terminal output or commands are saved
- Sessions can be reattached but start with empty history

### Session Cleanup
- Dead sessions are automatically removed after 24 hours
- No historical data is retained

## Security Measures

- All passwords are hashed using bcrypt
- JWT tokens for authentication
- WebSocket connections are authenticated
- No sensitive data in logs
- Container isolation available for enhanced security

## User Rights

- Users can delete their sessions at any time
- Account deletion removes all associated data
- No data is shared with third parties
- No analytics or tracking

## Open Source

This project is open source. You can review our privacy implementation in the source code at: https://github.com/fbzhong/claude-web

## Contact

For privacy concerns or questions, please open an issue on our GitHub repository.
