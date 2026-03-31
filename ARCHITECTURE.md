# MuniLens — System Architecture

## Overview

MuniLens is a five-layer IoT-to-cloud municipal infrastructure reporting platform. Citizens submit fault reports via a web app; a Raspberry Pi edge device performs on-site classification and verification; data flows through Firebase to a 3D admin dashboard powered by Cesium and AI-generated analytics.

---

## Layer 1 — Hardware

| Component | Details |
|---|---|
| **Raspberry Pi 4 Model B** | Primary edge compute node; runs the full Python pipeline |
| **Camera Module 3** | High-resolution (1920×1080) image capture via Picamera2 |
| **GPIO Capture Button** | GPIO 17 — physical push-button to trigger the capture pipeline |
| **GPIO Drone Button** | GPIO 27 — manual drone dispatch override button |
| **ESP32 Microcontroller** | Secondary controller connected via UART serial (/dev/ttyUSB0, 115200 baud) |
| **USB Serial Cable** | Pi ↔ ESP32 communication link |
| **Drone Hardware** | Dispatched by ESP32 on receipt of `DRONE_DISPATCH` serial command |

---

## Layer 2 — Edge Computing

| Component | Technology | Purpose |
|---|---|---|
| **TFLite Inference Engine** | `tflite-runtime` / `tensorflow.lite` | On-device fault classification — no cloud round-trip required |
| **Teachable Machine Model** | `model_unquant.tflite` + `labels.txt` | 5-class image classifier (Water Leak, Pothole, Pothole+Water, Electric Infra Damage, Road Cracks) |
| **Picamera2 Driver** | Python `Picamera2` library | Camera capture and configuration |
| **Image Preprocessing** | `Pillow` + `NumPy` | Resize to model input dimensions, normalise to [0, 1] |
| **Confidence Gate** | Threshold = 0.6 | Labels below threshold fall back to "Unclassified" |
| **Threading Model** | Python `threading` | Capture pipeline and Firestore listeners run concurrently without blocking GPIO |
| **Serial Command Bus** | `pyserial` | Sends `SCANNING` / `SUCCESS` / `DRONE_DISPATCH` / `IDLE` to ESP32 |
| **IoT Python Script** | `iot_rpi.py` | Orchestrates all edge-side behaviour with three parallel Firestore watchers |

### Edge Firestore Watchers (all run simultaneously)

| Watcher | Collection | Trigger |
|---|---|---|
| `start_firestore_listener()` | `reports` where `status == "Open"` | Queues citizen-submitted reports into `active_report` |
| `start_pi_command_listener()` | `piCommands` where `processed == false` | Executes remote camera trigger from admin web UI |
| `start_fault_listener()` | `faults` where `verified == false` | Executes fault verification dispatch from FaultVerification page |

---

## Layer 3 — Communication

| Channel | Protocol / Technology | Direction | Purpose |
|---|---|---|---|
| **Pi → Firebase Storage** | HTTPS (firebase-admin SDK) | Uplink | Uploads captured fault images as public blobs |
| **Pi → Firestore** | gRPC (firebase-admin SDK) | Uplink | Writes classification results, verified status, drone dispatch fields |
| **Firestore → Pi** | gRPC `on_snapshot` (long-lived) | Downlink | Real-time push of new reports, piCommands, fault dispatches |
| **Web App → Firestore** | Firebase JS SDK v12 (modular) | Uplink | Report submissions, admin status updates, piCommands creation, fault dispatch creation |
| **Firestore → Web App** | Firebase JS SDK `onSnapshot` | Downlink | Real-time dashboard updates, notification alerts, fault card verification |
| **Pi → ESP32** | UART Serial (115200 baud) | Downlink | LED state and drone dispatch commands |
| **Authentication** | Firebase Auth (email/password + Google OAuth) | Both | User identity, role-based access control |
| **Service Account** | Firebase Admin SDK key (JSON) | Pi only | Pi bypasses Firestore Security Rules for trusted writes |

---

## Layer 4 — Cloud & AI

### Firebase Platform
| Service | Usage |
|---|---|
| **Firebase Authentication** | Email/password and Google sign-in; UID-based identity |
| **Cloud Firestore** | Primary database — `reports`, `users`, `piCommands`, `faults` collections; real-time listeners |
| **Firebase Storage** | Stores all captured fault images (`fault_images/` prefix); public URLs embedded in Firestore docs |
| **Firestore Security Rules** | Role-based access control — citizens, admins, and Pi service account have distinct permissions per collection |

### AI & Analytics
| Component | Technology | Purpose |
|---|---|---|
| **Weekly AI Report** | Google Gemini `gemini-3-flash-preview` via `@google/genai` | Generates structured JSON briefing: headline, executive summary, risk level, priority actions, trend insights |
| **Fault Classification (browser)** | TensorFlow.js `@tensorflow/tfjs` + Teachable Machine model | In-browser classification of citizen-submitted photos during report submission |
| **Fault Classification (edge)** | TFLite on Raspberry Pi | On-device classification of Pi-captured verification photos |
| **Importance Mapping** | Rule-based (Electric Infra Damage → Critical; others → High/Medium) | Maps AI label to importance level; gates drone dispatch |

### Firestore Collections
| Collection | Writer | Reader |
|---|---|---|
| `reports` | Citizens (create), Admin (update), Pi (update) | All authenticated users |
| `users` | Citizens (self-create/update), Admin (update any) | Owner or Admin |
| `piCommands` | Admin web app | Admin web app + Pi service account |
| `faults` | Admin web app | All authenticated users; Pi service account (update) |

---

## Layer 5 — Application & 3D

### Frontend Stack
| Technology | Version | Role |
|---|---|---|
| **React** | 19 | Component framework |
| **TypeScript** | 5.8 | Type safety across all source files |
| **Vite** | 6 | Build tool and HMR dev server |
| **Tailwind CSS** | 4 | Utility-first styling |
| **React Router** | 7 | Client-side routing (SPA) |
| **Framer Motion** | 12 (`motion`) | Page and card animations |

### 3D & Mapping
| Technology | Role |
|---|---|
| **CesiumJS** | 3D globe rendering engine |
| **Resium** | React bindings for CesiumJS |
| **vite-plugin-cesium** | Asset handling for Cesium build artifacts |
| **Leaflet + react-leaflet** | 2D interactive map fallback (MapPage) |

### UI Components
| Component | Description |
|---|---|
| `Dashboard.tsx` | Admin panel — report table, charts (Recharts), notifications, AI briefing, report detail modal, Pi camera trigger button |
| `FaultVerification.tsx` | Live fault dispatch page — queries critical unverified faults, dispatches IoT, polls for verified results in real time |
| `ReportForm.tsx` | Citizen report submission with photo upload and TF.js browser classification |
| `MapPage.tsx` | Cesium 3D globe + Leaflet 2D map showing all geolocated reports |
| `UserManagement.tsx` | Admin user list — enable/suspend, promote/demote roles |
| `Leaderboard.tsx` | Gamified citizen contribution rankings |
| `CitizenScoreCard.tsx` | Per-citizen report history and score |
| `NotificationsPanel.tsx` | Real-time alert feed; critical reports show persistent toast with `ShieldAlert` icon |
| `Auth.tsx` | Login/register with email or Google |

### Internationalisation
| Language | Code |
|---|---|
| English | `en` |
| Afrikaans | `af` |
| IsiXhosa | `xh` |
| IsiZulu | `zu` |

### PDF Export
| Library | Usage |
|---|---|
| `jsPDF` | Exports the AI weekly report briefing to a formatted PDF |
| `html2canvas` | Captures rendered AI report card for PDF embedding |

---

## End-to-End Data Flow

```
Citizen submits report (ReportForm.tsx)
  → TF.js classifies photo in browser
  → Report written to Firestore reports collection
    → Dashboard onSnapshot fires → admin notified via toast
      → Admin opens report modal → clicks "Trigger Pi Camera"
        → piCommands document written to Firestore
          → Pi on_pi_command listener fires
            → Pi captures photo → TFLite classifies → uploads to Storage
              → Firestore report updated (type, photoUrl, importance)
                → If importance == Critical → dispatch_drone() → ESP32 UART command

Admin clicks "Verify with IoT" (FaultVerification.tsx)
  → faults document written (verified: false)
    → Pi on_fault_dispatch listener fires
      → Pi captures → classifies → uploads → faults doc updated (verified: true)
        → FaultVerification card flips to verified state in real time
```
