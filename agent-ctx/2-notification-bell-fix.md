# Task 2: Notification Bell Icon Fix

## Summary
Fixed the notification bell icon behavior in the header so that clicking it always opens/closes the dropdown, instead of triggering the browser permission dialog when notifications are disabled.

## Problem
The `handleToggle` function in `src/components/notification-center.tsx` had confusing UX:
- If notifications were NOT enabled → it called `toggleNotifications()` which requests browser notification permission
- If notifications WERE enabled → it toggled the dropdown open/close

This meant the first click on the bell would show a browser permission dialog instead of the notification panel, which is bad UX.

## Fix
Changed `handleToggle` to always toggle the dropdown (`setOpen(!open)`), regardless of notification state. The enable/disable button inside the dropdown footer already calls `toggleNotifications()` which handles the permission request — this is the correct place for it, since the user explicitly clicks that button.

## Changed Files
- `src/components/notification-center.tsx` — Changed `handleToggle` from conditional (permission request vs dropdown toggle) to always toggle the dropdown

## What Was NOT Changed
- `src/hooks/use-notifications.ts` — No changes needed; the hook logic is correct
- Visual design, translation keys, and icon behavior remain the same
- The enable/disable toggle in the dropdown footer continues to work as before
- BellOff icon in muted color when disabled, Bell icon in green when enabled
- Badge count shows unread notifications when enabled
