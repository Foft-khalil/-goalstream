---
Task ID: 1
Agent: Main Agent
Task: Fix "Regarder" button not working - streams fail and player gets stuck

Work Log:
- Investigated the issue: when clicking "Regarder", match-stream API finds channels correctly but the IPTV streams are often dead/offline
- The video player would show loading forever or an error with no easy way to try another channel
- Added playerAlternatives to the store - openPlayer now accepts an array of alternative channels
- Rewrote MatchCard to use handleQuickPlay - finds channels and auto-opens first one, passing others as alternatives
- Added a TV icon button to manually show the channel picker
- Rewrote VideoPlayer with auto-switch: when a stream fails, it automatically tries the next alternative channel
- Improved HLS timeout settings for faster failure detection (10s timeout, 1 retry max)
- Error overlay now shows all alternative channels with SkipForward icons
- Updated match-stream API to return 8 channels (was 5) and prioritize HLS (.m3u8) streams
- Added HTTPS priority and non-HTTPS penalty in channel scoring
- Fixed React 19 strict lint issues with setState in effects

Stage Summary:
- Clicking "Regarder" now: finds channels → opens first one → auto-tries next if it fails
- Video player auto-cycles through available channels on stream failure
- Better error UI with list of alternative channels to try
- Lint passes clean, dev server running
