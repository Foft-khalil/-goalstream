---
Task ID: 1
Agent: Main
Task: Install dependencies and update Prisma schema

Work Log:
- Installed hls.js and iptv-playlist-parser packages
- Updated Prisma schema with User, Account, Session, VerificationToken, Match, Channel models
- Ran db:push to sync schema to SQLite database

Stage Summary:
- Dependencies installed successfully
- Database schema includes full auth support (NextAuth.js models) plus Match and Channel models
- Channel model has unique constraint on name+url for upsert support
