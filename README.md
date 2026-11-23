# DTA - Dhata Te Achi (ডিটিএ - ঢাকাতে আছি)

A stylized, mobile-first 3D Dhaka-inspired motorcycle arcade game branded for **Nitol-Niloy Group (নিটল-নিলয় গ্রুপ)**, built with **Three.js**, **React**, **TypeScript**, and **Web Audio API**.

## Features
- **Hero Motorcycle Only (0.62 Scale)**: Custom metallic fuel tank with **Hero / Nitol-Niloy** decals, twin rear shocks, disc brake & fender, swept exhaust with smoke particles, boost flame, dynamic lean/pitch, and fuel port for nozzle hose attachment.
- **720 m Real Dhaka City Loop & Multi-Road Grid**:
  - Seamless `720 m` (`9 × 80 m` blocks) arterial corridor running along `-Z`, flanked by **4 parallel N–S side avenues** (`±34`, `±62`), **4 major E–W boulevards**, and **5 drivable connecting side alleys (`গলি`)**.
  - Overhead **Dhaka Metro Rail (MRT Line-6)** viaduct with banners, animated MRT train, and **3 official elevated stations** (**ফার্মগেট / Farmgate**, **শাহবাগ / Shahbag**, **মতিঝিল / Motijheel**) featuring visible **diagonal 3D escalators (`চলন্ত সিঁড়ি`)** ascending from both sidewalks.
  - Highway directional gantry signs (**মহাখালী**, **গুলিস্তান**, **ফার্মগেট**, **শাহবাগ**, **মিরপুর-১০**, **উত্তরা**, **ধানমন্ডি**), Tong tea stalls, rickshaw-art arches, and humorous Bengali roadside signs across main roads and side avenues.
  - Bengali joke boards attached to streetlights along the arterial road, all four downtown avenues, and cross-city streets.
  - Solid building AABBs (`Bld_*`) and perimeter walls with spark/thud scrapes instead of sideways bounce.
- **Keep-Left Traffic & 24-Archetype Fleet**:
  - Left arterial lanes (`-6.75, -3.25`) move `-Z` with the player; right lanes (`+3.25, +6.75`) carry oncoming traffic `+Z`; downtown avenues and alleys also enforce Bangladesh keep-left traffic.
  - 24 vehicle types across Small, Medium, and Large tiers: Bicycle, Rickshaw, Van-Gari, CNG, Commuter Biker, Hatchback, Sedan, Taxi, Sport, Muscle, Pickup, Leguna, Microbus Van, DMP Police, Ambulance, RAB Van, **Nitol-Niloy Staff Bus (`নিটল-নিলয় স্টাফ বাস`)**, **Nitol Bus**, **BRTC**, **Hanif**, **Shohag**, Cargo Truck, Bangladesh Army Van, and Monster Truck.
  - Traffic obeys RED/YELLOW signals and crosswalk pedestrians while the player breaks signals (`+200 × combo`) and smashes through smaller vehicles.
- **Addictive Replay Loop (Pickups, Missions, Raja Fever & Ranks)**:
  - Collectible **৳ Taka Coins**, **Petrol Jerrycans (`+18% তেল`)**, and **Nitro Surge Orbs** across main & city lanes.
  - Cycling **Live Micro-Missions** with instant bonus payouts, **Raja Fever (`combo >= 5`)**, and progressive Dhaka rider ranks (**ঢাকার রাস্তার রাজা**).
- **Combat, Witness Mob & Scripted Slapper**:
  - Smash small/medium vehicles for combo points (`x1`–`x10`), explosions, and fading debris while keeping bike control.
  - High-speed collisions with Large vehicles (buses/trucks) or getting caught by the angry witness mob trigger a scripted **Slapper** big-crash sequence before Game Over.
- **Petrol ("তেল / জ্বালানি") & Animated Refuel Hose**:
  - Three stations (`arterial_pump` at `-360 m`, `downtown_west_pump` at `-40 m`, and `downtown_east_pump` at `-360 m` off the city avenues).
  - Slow below `24 km/h` on a Fuel Pad to attach an animated curved hose directly from the dispenser to the bike tank (`"ট্যাংক ফুল!"` bonus).
  - Running empty and stopping off-station for 4 seconds ends the run (`"জ্বালানি শেষ!"`).
- **Rule-Breaker Scoring & Bengali Quips**:
  - Wrong-way (`+15/s`), sidewalk riding (`+10/s`), and red-light smashing (`+200 × combo`), plus `+250` district lap bonuses and humorous Bengali speed quips above `80 km/h`.

## Controls

### Keyboard
- **W / Up Arrow**: Accelerate (`চলুন`)
- **S / Down Arrow**: Brake / Reverse (`ব্রেক / পেছনে`)
- **A / Left Arrow / , (Comma)**: Steer Left (`বাম`)
- **D / Right Arrow / . (Period)**: Steer Right (`ডান`)
- **Left Shift**: Boost (`বুস্ট`)
- **Space**: Handbrake (`হ্যান্ডব্রেক`)
- **H**: Horn (`হর্ন`)
- **Enter**: Start from Menu / Restart from Game Over
- **R**: Restart after Game Over
- **Esc**: Pause / Resume mid-ride (also closes the Showroom)

### Touch / Mobile
- Lower-center multi-touch cluster with **ব্রেক (BRAKE)** centered, surrounded by **^ চলুন (ACCEL)**, **বুস্ট (BOOST)**, **হর্ন (HORN)**, **< বাম (LEFT)**, **ডান > (RIGHT)**, and **v পেছনে (REV)**.
- Pause button in the top-right dock; the game also auto-pauses when the tab loses focus.

### Motion (Device Tilt)
- Tap the **smartphone icon** in the top-right dock to toggle **motion steering**. Hold the phone comfortably, then **roll it left/right to steer** — no on-screen steering buttons required (the touch steering buttons still take priority while held).
- **Requires HTTPS** (or `localhost`). Mobile browsers only deliver `deviceorientation` sensor events in a secure context, so a plain `http://vps-ip:3005/...` URL silently blocks tilt — the bike will not turn. Put the game behind HTTPS (Caddy / nginx + Let's Encrypt) or expose it through a quick HTTPS tunnel (`cloudflared tunnel --url http://localhost:3005`, `npx localtunnel --port 3005`) and open that `https://` URL on the phone.
- On iOS 13+ the browser shows a motion-access permission prompt the first time; tap **Allow**.
- The dock icon reports state: **amber + pulsing** = waiting for sensor data, **sky blue** = active, **red** = unsupported / permission denied / not a secure context. A Bengali toast also explains any failure.
- A short neutral calibration is captured whenever motion mode is enabled, the ride starts, or the game resumes, so whatever angle you hold the phone at becomes "straight ahead". Tilt sensitivity is **speed-aware** (game-quality feel): at crawl speed full lock is reached at ~22° (nimble), and at high speed it gradually requires up to ~42° (planted, no twitch). The deadzone also widens with speed to absorb hand tremor.
- Motion control adds **auto-throttle** so you only tilt to steer, capped at a controllable cruising pace (~72% of the bike's normal max) instead of pinning to top speed. Hold **v পেছনে (REV/BRAKE)** or the handbrake to slow down; **বুস্ট (BOOST)** still overrides for bursts (or Left Shift). Leaning hard at speed gently scrubs a little speed to maintain grip (cornering feel).

### Audio
- **SFX** (engine, horns, impacts, voice lines) and **Music** (menu loop) can be muted independently from the pause menu or the top-right dock toggles.

## Setup & Build

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```
