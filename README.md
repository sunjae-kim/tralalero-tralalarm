# Tralalero Tralalarm

Browser alarm with two hourly minute slots and selectable audio or browser notifications.

Live site: https://tralalero-tralalarm.netlify.app/

## Alarm timing contract

- After user activation, decoded audio is scheduled on the Web Audio clock for 48 future occurrences per active minute slot. The worker and foreground timer handle wake-up and recovery; neither is the exact-audio clock.
- Audio suspension invalidates unstarted sources. Resume and clock-drift checks rebuild future sources from wall-clock targets, retain confirmation of already-started occurrences, and refill both minute families without cancelling valid imminent sources.
- A pending, unstarted boundary can catch up once when execution/audio resumes. Intermediate missed hourly occurrences are not replayed in a burst; the next boundary is computed from the actual delivery time, including queued worker messages. Cancelling an alarm also invalidates asynchronous sound loads.
- A browser page cannot guarantee an alarm while the browser or OS prevents execution/audio, during computer sleep, or after tab discard. A reload may require user activation again; blocked audio is not shown as ready.

## Verification

```sh
npm test
npm run lint
npm run build
```

For browser acceptance, use the exact production bundle and real audio APIs. Cover suspension/resume without a second tap, page freezing across a boundary, queued stale worker delivery, two-slot refill, and disabling alarms before resume. Keep controlled-clock results separate from long-hidden-tab, device-sleep, and audible-device acceptance.
